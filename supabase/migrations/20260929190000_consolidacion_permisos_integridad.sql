-- =====================================================================
-- CONSOLIDACIÓN: PERMISOS, ALBARANES FIRMADOS, OPERACIONES ATÓMICAS Y
-- AUDITORÍA
--
-- Responde a la revisión del 29/09/2026 (informe «Análisis de ELSA ERP»):
--
--   S1  Todas las políticas eran «con sesión, todo». Cualquier cuenta podía
--       tocar configuración, perfiles y contadores, y borrar lo que fuera.
--       Ahora hay dos roles (admin y operario) y la base de datos los aplica:
--       ocultar un botón no protege nada, la API sigue abierta.
--   S2  Un albarán firmado se podía editar y borrar, y su PDF se regeneraba
--       con los datos actuales. Ahora al firmar se congela el contenido con
--       su huella SHA-256 y hora del servidor, y un firmado ya no se modifica
--       ni se borra: se anula (queda rastro) y se hace otro.
--   A2  Firmar, emitir albarán y aceptar una solicitud eran varias llamadas
--       sueltas desde el navegador. Ahora cada una es una función que se
--       ejecuta entera o no se ejecuta.
--   A3  El albarán creado desde un servicio no guardaba cliente_id.
--   F1  NIF y dirección de facturación escritos en un documento se perdían.
--       -- Trazabilidad: quién cambió qué y cuándo (tabla auditoria).
--
-- COMPATIBILIDAD: se puede aplicar ANTES de desplegar el código nuevo. Todas
-- las cuentas que existen hoy quedan como admin, así que nadie pierde acceso.
-- Lo único que cambia para el código antiguo es que editar o borrar un
-- albarán firmado ahora da error, que es justo lo que se busca.
--
-- Idempotente: se puede reejecutar sin romper nada.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- ---------------------------------------------------------------------
-- 0. LIMPIEZA PENDIENTE
-- ---------------------------------------------------------------------

-- Trigger duplicado de numeración en servicios (el esquema base ya avisaba:
-- dos triggers haciendo lo mismo). Se queda trg_asignar_numero_servicio.
DROP TRIGGER IF EXISTS trg_numero_servicio ON public.servicios;

-- RPC original de numeración, sin uso y con el off-by-one del SRV-002
DROP FUNCTION IF EXISTS public.next_solicitud_numero();


-- ---------------------------------------------------------------------
-- 1. updated_at DE VERDAD
--    Las tablas tenían la columna pero nada la actualizaba: se quedaba con
--    la fecha de alta. Hace falta para auditar y, más adelante, para
--    detectar que dos personas editan lo mismo a la vez.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tocar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes','solicitudes','servicios','albaranes','vehiculos',
    'eventos','config','perfiles','deca'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.tocar_updated_at()', t);
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 2. PERFILES Y ROLES
-- ---------------------------------------------------------------------

-- Las altas nuevas nacen con el mínimo de permisos. Subir a admin es una
-- decisión explícita:  update public.perfiles set rol = 'admin' where id = '...';
ALTER TABLE public.perfiles ALTER COLUMN rol SET DEFAULT 'operario';

-- Las cuentas que ya existen hoy entran como admin: es lo que eran de hecho
-- y así aplicar esta migración no deja a nadie fuera.
-- REVISAR DESPUÉS: las cuentas de prueba deberían desactivarse
-- (update public.perfiles set activo = false where id = '...').
INSERT INTO public.perfiles (id, nombre, rol, activo)
SELECT u.id, split_part(u.email, '@', 1), 'admin', true
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Cada cuenta nueva de Supabase Auth tiene su perfil desde el primer momento.
-- Sin perfil activo no se ve ni se toca nada (ver políticas más abajo).
CREATE OR REPLACE FUNCTION public.crear_perfil_de_usuario_nuevo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol, activo)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), 'operario', true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crear_perfil ON auth.users;
CREATE TRIGGER trg_crear_perfil
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_de_usuario_nuevo();

-- Funciones que usan las políticas. SECURITY DEFINER para poder leer
-- perfiles sin que la propia política de perfiles entre en bucle.
CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.rol FROM public.perfiles p
  WHERE p.id = auth.uid() AND p.activo IS TRUE
$$;

CREATE OR REPLACE FUNCTION public.es_usuario_activo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.activo IS TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.activo IS TRUE AND p.rol = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION public.mi_rol()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_usuario_activo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_admin()          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_rol()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_usuario_activo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin()          TO authenticated;


-- ---------------------------------------------------------------------
-- 3. NUMERACIÓN SIN ACCESO DIRECTO A LOS CONTADORES
--    Los triggers de numeración pasan a SECURITY DEFINER: numeran con los
--    permisos del propietario, así que los usuarios ya no necesitan poder
--    escribir en contadores. Antes cualquier sesión podía poner el contador
--    de albaranes a 1 y duplicar números.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_numero(p_clave text, p_prefijo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  n integer;
BEGIN
  -- Llamada directa por RPC (fuera de un trigger): solo para reservar el
  -- número del DeCA y solo con perfil activo. Si no, cualquier sesión, hasta
  -- una desactivada, podría quemar números de albarán y dejar huecos.
  IF pg_trigger_depth() = 0 AND (p_clave <> 'deca' OR NOT public.es_usuario_activo()) THEN
    RAISE EXCEPTION 'No se puede reservar un número de «%» directamente.', p_clave;
  END IF;
  UPDATE public.contadores
  SET next_number = next_number + 1, updated_at = now()
  WHERE clave = p_clave
  RETURNING next_number - 1 INTO n;
  IF n IS NULL THEN
    RAISE EXCEPTION 'No existe contador para la clave %', p_clave;
  END IF;
  RETURN p_prefijo || '-' || LPAD(n::text, GREATEST(3, length(n::text)), '0');
END;
$function$;

-- La app la llama por RPC para reservar el número del DeCA antes de generar
-- el PDF. Solo con sesión.
REVOKE ALL ON FUNCTION public.next_numero(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_numero(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_solicitud_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    UPDATE public._solicitud_counter
    SET next_number = next_number + 1, updated_at = now()
    WHERE id = 1
    RETURNING next_number - 1 INTO next_num;
    NEW.numero := 'S-' || LPAD(next_num::text, GREATEST(3, length(next_num::text)), '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.asignar_numero_servicio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero('servicio', 'SRV');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.asignar_numero_albaran()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero('albaran', 'ALB');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.asignar_numero_deca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero('deca', 'DECA');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.asignar_numero_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  n integer;
BEGIN
  IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
    UPDATE public.contadores
    SET next_number = next_number + 1, updated_at = now()
    WHERE clave = 'cliente'
    RETURNING next_number - 1 INTO n;
    NEW.numero := n::text;
  ELSE
    NEW.numero := btrim(NEW.numero);
    IF NEW.numero ~ '^[0-9]+$' THEN
      UPDATE public.contadores
      SET next_number = NEW.numero::integer + 1, updated_at = now()
      WHERE clave = 'cliente' AND next_number <= NEW.numero::integer;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;


-- ---------------------------------------------------------------------
-- 4. COLUMNAS NUEVAS
-- ---------------------------------------------------------------------

-- F1: NIF y dirección de facturación escritos en el documento. Igual que
-- telCliente/emailCliente: lo del documento manda y, si está vacío, se usa la
-- ficha del cliente. Así una corrección en el documento no se pierde al
-- recargar y la ficha no se pisa sin querer.
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS "nifCif"  text;
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS "dirFact" text;
ALTER TABLE public.servicios   ADD COLUMN IF NOT EXISTS "nifCif"  text;
ALTER TABLE public.servicios   ADD COLUMN IF NOT EXISTS "dirFact" text;
ALTER TABLE public.albaranes   ADD COLUMN IF NOT EXISTS "nifCif"       text;
ALTER TABLE public.albaranes   ADD COLUMN IF NOT EXISTS "dirFact"      text;
ALTER TABLE public.albaranes   ADD COLUMN IF NOT EXISTS "telCliente"   text;
ALTER TABLE public.albaranes   ADD COLUMN IF NOT EXISTS "emailCliente" text;

-- S2: lo que queda congelado al firmar, y la anulación trazable
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS contenido_firmado   jsonb;
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS huella_sha256       text;
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS firmado_por_usuario uuid;
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS anulado             boolean NOT NULL DEFAULT false;
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS anulado_en          timestamptz;
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS anulado_por         uuid;
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS motivo_anulacion    text;

CREATE INDEX IF NOT EXISTS idx_albaranes_servicio_id ON public.albaranes(servicio_id);
CREATE INDEX IF NOT EXISTS idx_servicios_solicitud_id ON public.servicios(solicitud_id);


-- ---------------------------------------------------------------------
-- 5. ALBARANES FIRMADOS INMUTABLES
-- ---------------------------------------------------------------------

-- Foto fija de todo lo que sale en el albarán en el momento de firmar: el
-- propio albarán, la ficha del cliente, el servicio y los datos de la
-- empresa. El PDF de un firmado se genera SIEMPRE desde aquí, no desde los
-- datos actuales, que pueden haber cambiado.
CREATE OR REPLACE FUNCTION public.foto_albaran(a public.albaranes)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c   public.clientes;
  s   public.servicios;
  cfg public.config;
BEGIN
  IF a.cliente_id IS NOT NULL THEN
    SELECT * INTO c FROM public.clientes WHERE id = a.cliente_id;
  END IF;
  IF a.servicio_id IS NOT NULL THEN
    SELECT * INTO s FROM public.servicios WHERE id = a.servicio_id;
  END IF;
  SELECT * INTO cfg FROM public.config WHERE id = 1;

  RETURN jsonb_build_object(
    'version', 1,
    'albaran', jsonb_build_object(
      'id', a.id, 'numero', a.numero, 'fecha', a.fecha,
      'cliente', a.cliente, 'cliente_id', a.cliente_id,
      'descripcion', a.descripcion, 'lineas', COALESCE(a.lineas, '[]'::jsonb),
      'fotos', COALESCE(a.fotos, '[]'::jsonb),
      'firmado_por', a.firmado_por, 'firmado_en', a.firmado_en,
      'firma_sha256', encode(extensions.digest(COALESCE(a.firma, ''), 'sha256'), 'hex')
    ),
    'cliente', jsonb_build_object(
      'numero', c.numero, 'nombre', COALESCE(c.nombre, a.cliente),
      'nombre_comercial', c.nombre_comercial,
      'nifCif',  COALESCE(NULLIF(a."nifCif", ''),  c."nifCif"),
      'dirFact', COALESCE(NULLIF(a."dirFact", ''), c."dirFact"),
      'cp', c.cp, 'poblacion', c.poblacion, 'provincia', c.provincia,
      'tel',   COALESCE(NULLIF(a."telCliente", ''),   c.tel, c.movil),
      'email', COALESCE(NULLIF(a."emailCliente", ''), c.email)
    ),
    'servicio', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', s.id, 'numero', s.numero, 'vehiculo', s.vehiculo,
      'origen', s.origen, 'destino', s.destino,
      'fecha_servicio', s.fecha_servicio,
      'hora_inicio', s.hora_inicio, 'hora_fin', s.hora_fin
    ) END,
    'empresa', jsonb_build_object(
      'nombre', cfg.nombre, 'nif', cfg.nif, 'tel', cfg.tel, 'email', cfg.email,
      'direccion', cfg.direccion, 'web', cfg.web,
      'autorizacion_transporte', cfg.autorizacion_transporte
    )
  );
END;
$$;

-- Solo la usan el trigger de firma y esta migración. Es SECURITY DEFINER y
-- lee clientes, servicios y config saltándose RLS: expuesta por la API,
-- cualquiera (anon incluido) podría leer la ficha de un cliente pasándole un
-- cliente_id inventado.
REVOKE ALL ON FUNCTION public.foto_albaran(public.albaranes) FROM PUBLIC, anon, authenticated;

-- Albaranes firmados antes de esta migración: se congelan con los datos de
-- hoy y quedan marcados como retroactivos. No prueban lo que se firmó en su
-- día (eso ya no se puede reconstruir), pero a partir de ahora no cambian.
-- Va ANTES del trigger de protección, que no dejaría hacer este UPDATE.
DROP TRIGGER IF EXISTS trg_proteger_albaran ON public.albaranes;
DROP TRIGGER IF EXISTS trg_proteger_borrado_albaran ON public.albaranes;

UPDATE public.albaranes a
SET contenido_firmado = public.foto_albaran(a) || jsonb_build_object('retroactivo', true, 'congelado_en', now()),
    huella_sha256 = NULL
WHERE a.estado = 'firmado' AND a.contenido_firmado IS NULL;

UPDATE public.albaranes
SET huella_sha256 = encode(extensions.digest(contenido_firmado::text, 'sha256'), 'hex')
WHERE estado = 'firmado' AND huella_sha256 IS NULL AND contenido_firmado IS NOT NULL;

CREATE OR REPLACE FUNCTION public.proteger_albaran()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Lo único que puede cambiar en un firmado
  permitidos text[] := ARRAY['servicio_id','anulado','anulado_en','anulado_por','motivo_anulacion','updated_at'];
BEGIN
  -- ---- Ya estaba firmado: solo se puede anular o desvincular del servicio
  IF TG_OP = 'UPDATE' AND OLD.estado = 'firmado' THEN
    IF (to_jsonb(NEW) - permitidos) IS DISTINCT FROM (to_jsonb(OLD) - permitidos) THEN
      RAISE EXCEPTION 'El albarán % está firmado y no se puede modificar. Si hay un error, anúlalo y crea uno nuevo.', OLD.numero
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.servicio_id IS DISTINCT FROM OLD.servicio_id AND NEW.servicio_id IS NOT NULL THEN
      RAISE EXCEPTION 'Un albarán firmado no se puede vincular a otro servicio.';
    END IF;
    IF OLD.anulado AND NOT NEW.anulado THEN
      RAISE EXCEPTION 'Un albarán anulado no se puede reactivar.';
    END IF;
    IF NEW.anulado AND NOT OLD.anulado THEN
      IF NOT public.es_admin() THEN
        RAISE EXCEPTION 'Solo administración puede anular un albarán firmado.';
      END IF;
      IF COALESCE(btrim(NEW.motivo_anulacion), '') = '' THEN
        RAISE EXCEPTION 'Para anular un albarán hay que indicar el motivo.';
      END IF;
      NEW.anulado_en  := now();
      NEW.anulado_por := auth.uid();
    ELSIF NEW.anulado_en IS DISTINCT FROM OLD.anulado_en
       OR NEW.anulado_por IS DISTINCT FROM OLD.anulado_por
       OR NEW.motivo_anulacion IS DISTINCT FROM OLD.motivo_anulacion THEN
      RAISE EXCEPTION 'Los datos de anulación no se pueden cambiar.';
    END IF;
    RETURN NEW;
  END IF;

  -- ---- Se firma ahora: validar, sellar con hora del servidor y congelar
  IF NEW.estado = 'firmado' THEN
    IF COALESCE(NEW.firma, '') = '' OR COALESCE(btrim(NEW.firmado_por), '') = '' THEN
      RAISE EXCEPTION 'Para firmar hace falta la firma y el nombre de quien firma.';
    END IF;
    NEW.firmado_en          := now();          -- hora del servidor, no del móvil
    NEW.firmado_por_usuario := auth.uid();
    NEW.anulado             := false;
    NEW.contenido_firmado   := public.foto_albaran(NEW);
    NEW.huella_sha256       := encode(extensions.digest(NEW.contenido_firmado::text, 'sha256'), 'hex');
  ELSE
    -- Un borrador no lleva datos de firma ni de anulación colados
    NEW.contenido_firmado   := NULL;
    NEW.huella_sha256       := NULL;
    NEW.firmado_por_usuario := NULL;
    NEW.anulado := false; NEW.anulado_en := NULL; NEW.anulado_por := NULL; NEW.motivo_anulacion := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- El nombre empieza por «trg_p», detrás de «trg_asignar_numero_albaran»:
-- los BEFORE se ejecutan por orden alfabético y la foto necesita el número.
CREATE TRIGGER trg_proteger_albaran
BEFORE INSERT OR UPDATE ON public.albaranes
FOR EACH ROW EXECUTE FUNCTION public.proteger_albaran();

CREATE OR REPLACE FUNCTION public.proteger_borrado_albaran()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado = 'firmado' THEN
    RAISE EXCEPTION 'El albarán % está firmado y no se puede borrar. Anúlalo en su lugar.', OLD.numero;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_proteger_borrado_albaran
BEFORE DELETE ON public.albaranes
FOR EACH ROW EXECUTE FUNCTION public.proteger_borrado_albaran();


-- ---------------------------------------------------------------------
-- 6. OPERACIONES DE NEGOCIO ATÓMICAS
--    SECURITY INVOKER (lo normal): se ejecutan con los permisos de quien
--    las llama, así que las políticas de la sección 7 se siguen aplicando.
--    Lo que ganan es que todo lo de dentro se confirma junto o no se
--    confirma nada, y que repetir la llamada no duplica nada.
-- ---------------------------------------------------------------------

-- Firmar un albarán y cerrar su servicio, de una vez.
CREATE OR REPLACE FUNCTION public.firmar_albaran(p_id uuid, p_firma text, p_firmado_por text)
RETURNS public.albaranes
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  a public.albaranes;
BEGIN
  SELECT * INTO a FROM public.albaranes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el albarán o no tienes acceso.';
  END IF;
  IF a.estado = 'firmado' THEN
    -- Doble toque en «Guardar firma»: se devuelve el ya firmado, sin error
    RETURN a;
  END IF;

  UPDATE public.albaranes
  SET firma = p_firma, firmado_por = btrim(p_firmado_por), estado = 'firmado'
  WHERE id = p_id
  RETURNING * INTO a;

  IF a.servicio_id IS NOT NULL THEN
    UPDATE public.servicios SET estado = 'realizado'
    WHERE id = a.servicio_id AND COALESCE(estado, 'abierto') <> 'realizado';
  END IF;

  RETURN a;
END;
$$;

-- Generar el albarán de un servicio: guarda las horas reales, cierra el
-- servicio y crea el albarán con el cliente vinculado por id. Si el servicio
-- ya tiene un albarán vigente, devuelve ese en vez de crear otro.
CREATE OR REPLACE FUNCTION public.emitir_albaran_de_servicio(
  p_servicio_id uuid, p_hora_inicio time DEFAULT NULL, p_hora_fin time DEFAULT NULL)
RETURNS public.albaranes
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  s public.servicios;
  a public.albaranes;
BEGIN
  SELECT * INTO s FROM public.servicios WHERE id = p_servicio_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el servicio o no tienes acceso.';
  END IF;

  SELECT * INTO a FROM public.albaranes
  WHERE servicio_id = p_servicio_id AND anulado IS NOT TRUE
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN a;
  END IF;

  UPDATE public.servicios
  SET hora_inicio = COALESCE(p_hora_inicio, hora_inicio),
      hora_fin    = COALESCE(p_hora_fin, hora_fin),
      estado      = 'realizado'
  WHERE id = p_servicio_id
  RETURNING * INTO s;

  INSERT INTO public.albaranes
    (cliente, cliente_id, "nifCif", "dirFact", "telCliente", "emailCliente",
     fecha, descripcion, servicio_id, solicitud_id, lineas, estado)
  VALUES
    (s.cliente, s.cliente_id, s."nifCif", s."dirFact", s."telCliente", s."emailCliente",
     COALESCE(s.fecha_servicio, CURRENT_DATE), s.descripcion, s.id, s.solicitud_id, '[]'::jsonb, 'borrador')
  RETURNING * INTO a;

  RETURN a;
END;
$$;

-- Aceptar una solicitud y programar su servicio, de una vez. Antes la
-- solicitud quedaba «aceptada» aunque se cancelara el diálogo de la fecha, y
-- el servicio no llegaba a existir.
CREATE OR REPLACE FUNCTION public.aceptar_solicitud(
  p_solicitud_id uuid, p_fecha date, p_hora_inicio time DEFAULT NULL, p_hora_fin time DEFAULT NULL)
RETURNS public.servicios
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  sol public.solicitudes;
  s   public.servicios;
BEGIN
  SELECT * INTO sol FROM public.solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la solicitud o no tienes acceso.';
  END IF;

  UPDATE public.solicitudes
  SET estado = 'aceptado', fecha_ultimo_contacto = now()
  WHERE id = p_solicitud_id;

  SELECT * INTO s FROM public.servicios WHERE solicitud_id = p_solicitud_id
  ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    RETURN s;   -- ya estaba programada: no se duplica
  END IF;

  INSERT INTO public.servicios
    (cliente, cliente_id, "telCliente", "emailCliente", "nifCif", "dirFact",
     vehiculo, origen, destino, descripcion, notas_internas, precio, peso, bultos,
     fecha_servicio, hora_inicio, hora_fin, solicitud_id, estado, notas)
  VALUES
    (sol.cliente, sol.cliente_id, sol."telCliente", sol."emailCliente", sol."nifCif", sol."dirFact",
     sol.vehiculo, sol.origen, sol.destino, sol.descripcion, sol.notas_internas, sol.precio, sol.peso, sol.bultos,
     COALESCE(p_fecha, CURRENT_DATE), p_hora_inicio, p_hora_fin, sol.id, 'abierto', '[]'::jsonb)
  RETURNING * INTO s;

  RETURN s;
END;
$$;

-- Anular un albarán firmado (solo admin; el trigger lo comprueba y sella).
CREATE OR REPLACE FUNCTION public.anular_albaran(p_id uuid, p_motivo text)
RETURNS public.albaranes
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  a public.albaranes;
BEGIN
  SELECT * INTO a FROM public.albaranes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el albarán o no tienes acceso.';
  END IF;
  -- Un borrador se corrige o se borra; «anularlo» no dejaría nada anulado
  IF a.estado IS DISTINCT FROM 'firmado' THEN
    RAISE EXCEPTION 'Solo se anula un albarán firmado. Un borrador se edita o se borra.';
  END IF;

  UPDATE public.albaranes
  SET anulado = true, motivo_anulacion = btrim(p_motivo)
  WHERE id = p_id
  RETURNING * INTO a;
  RETURN a;
END;
$$;

REVOKE ALL ON FUNCTION public.firmar_albaran(uuid, text, text)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.emitir_albaran_de_servicio(uuid, time, time)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aceptar_solicitud(uuid, date, time, time)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anular_albaran(uuid, text)                        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firmar_albaran(uuid, text, text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_albaran_de_servicio(uuid, time, time)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_solicitud(uuid, date, time, time)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_albaran(uuid, text)                     TO authenticated;


-- ---------------------------------------------------------------------
-- 7. POLÍTICAS POR ROL
--
--   Sin perfil activo ....... nada (una cuenta desactivada deja de ver y
--                             tocar datos al momento, sin esperar a que
--                             caduque su sesión).
--   operario ................ ve todo lo operativo; crea y modifica
--                             servicios, albaranes (firmar incluido) y
--                             eventos; da de alta clientes y apunta
--                             mantenimientos. No borra nada, no toca
--                             presupuestos, flota, configuración ni perfiles.
--   admin ................... todo.
--
--   Limitar al operario a SUS trabajos asignados queda para cuando exista
--   el vínculo usuario ↔ trabajo en los datos (hoy no existe).
-- ---------------------------------------------------------------------

-- Fuera TODAS las políticas de estas tablas, se llamen como se llamen. Las
-- políticas se suman con OR: una sola «con sesión, todo» creada a mano desde
-- el panel con otro nombre dejaría sin efecto todo lo de abajo.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'clientes','solicitudes','servicios','albaranes','vehiculos',
        'mantenimientos','eventos','config','contadores','perfiles','deca',
        '_solicitud_counter'])
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Plantilla: (tabla, quién crea, quién modifica, quién borra)
--   'activo' = cualquier perfil activo · 'admin' = solo admin · NULL = nadie
DO $$
DECLARE
  r record;
  cond text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('clientes',       'activo', 'admin',  'admin'),
    ('solicitudes',    'admin',  'admin',  'admin'),
    ('servicios',      'activo', 'activo', 'admin'),
    ('albaranes',      'activo', 'activo', 'admin'),
    ('vehiculos',      'admin',  'admin',  'admin'),
    ('mantenimientos', 'activo', 'admin',  'admin'),
    ('eventos',        'activo', 'activo', 'admin'),
    ('config',         'admin',  'admin',  NULL),
    -- Un DeCA emitido se conserva: no se borra nunca. Anularlo es admin.
    ('deca',           'activo', 'admin',  NULL)
  ) AS v(tabla, crear, modificar, borrar)
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.es_usuario_activo())',
                   r.tabla || '_leer', r.tabla);

    IF r.crear IS NOT NULL THEN
      cond := CASE r.crear WHEN 'admin' THEN 'public.es_admin()' ELSE 'public.es_usuario_activo()' END;
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                     r.tabla || '_crear', r.tabla, cond);
    END IF;
    IF r.modificar IS NOT NULL THEN
      cond := CASE r.modificar WHEN 'admin' THEN 'public.es_admin()' ELSE 'public.es_usuario_activo()' END;
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                     r.tabla || '_modificar', r.tabla, cond, cond);
    END IF;
    IF r.borrar IS NOT NULL THEN
      cond := CASE r.borrar WHEN 'admin' THEN 'public.es_admin()' ELSE 'public.es_usuario_activo()' END;
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
                     r.tabla || '_borrar', r.tabla, cond);
    END IF;
  END LOOP;
END $$;

-- Perfiles: cada uno ve el suyo; admin los ve y gestiona todos. Un admin
-- no puede quitarse a sí mismo el rol (evita quedarse sin ningún admin por
-- un despiste): eso se hace desde el SQL Editor.
CREATE POLICY perfiles_leer ON public.perfiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.es_admin());
CREATE POLICY perfiles_crear ON public.perfiles
  FOR INSERT TO authenticated WITH CHECK (public.es_admin());
CREATE POLICY perfiles_modificar ON public.perfiles
  FOR UPDATE TO authenticated
  USING (public.es_admin() AND id <> auth.uid())
  WITH CHECK (public.es_admin() AND id <> auth.uid());
CREATE POLICY perfiles_borrar ON public.perfiles
  FOR DELETE TO authenticated USING (public.es_admin() AND id <> auth.uid());

-- Contadores: nadie los escribe directamente (la numeración va por las
-- funciones SECURITY DEFINER). Admin puede leerlos para la exportación.
CREATE POLICY contadores_leer ON public.contadores
  FOR SELECT TO authenticated USING (public.es_admin());
CREATE POLICY solicitud_counter_leer ON public._solicitud_counter
  FOR SELECT TO authenticated USING (public.es_admin());

-- ---- Storage
DROP POLICY IF EXISTS fotos_leer   ON storage.objects;
DROP POLICY IF EXISTS fotos_subir  ON storage.objects;
DROP POLICY IF EXISTS fotos_borrar ON storage.objects;

CREATE POLICY fotos_leer ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'service-photos' AND public.es_usuario_activo());
CREATE POLICY fotos_subir ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-photos' AND public.es_usuario_activo());
-- Una foto que forma parte de un albarán firmado es parte de lo firmado: no
-- se borra (el albarán congelado apunta a ella).
CREATE POLICY fotos_borrar ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'service-photos' AND public.es_usuario_activo()
         AND NOT EXISTS (
           SELECT 1 FROM public.albaranes a
           WHERE a.estado = 'firmado'
             AND a.fotos @> jsonb_build_array(jsonb_build_object('path', objects.name))));

-- DeCA: se puede subir; sobrescribir o borrar solo un PDF que todavía no
-- esté registrado en la tabla deca (la app lo necesita para limpiar si el
-- registro falla). Un DeCA emitido ya no se puede cambiar ni borrar.
DROP POLICY IF EXISTS deca_subir      ON storage.objects;
DROP POLICY IF EXISTS deca_actualizar ON storage.objects;
DROP POLICY IF EXISTS deca_borrar     ON storage.objects;

CREATE POLICY deca_subir ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deca-docs' AND public.es_usuario_activo());
CREATE POLICY deca_actualizar ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deca-docs' AND public.es_usuario_activo()
         AND NOT EXISTS (SELECT 1 FROM public.deca d WHERE d.pdf_path = name))
  WITH CHECK (bucket_id = 'deca-docs' AND public.es_usuario_activo());
CREATE POLICY deca_borrar ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deca-docs' AND public.es_usuario_activo()
         AND NOT EXISTS (SELECT 1 FROM public.deca d WHERE d.pdf_path = name));


-- ---------------------------------------------------------------------
-- 8. AUDITORÍA
--    Quién hizo qué, sobre qué registro y cuándo. Solo se escribe desde el
--    trigger (nadie puede insertar, cambiar ni borrar a mano) y solo la lee
--    admin. De los cambios se guarda únicamente lo que cambió; la imagen de
--    la firma y el logo se omiten por tamaño (la firma ya tiene su huella).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auditoria (
  id           bigserial PRIMARY KEY,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  usuario      uuid,
  tabla        text NOT NULL,
  registro_id  text,
  accion       text NOT NULL,            -- INSERT | UPDATE | DELETE
  cambios      jsonb
);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON public.auditoria(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_creado_en ON public.auditoria(creado_en);

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auditoria_leer ON public.auditoria;
CREATE POLICY auditoria_leer ON public.auditoria
  FOR SELECT TO authenticated USING (public.es_admin());

CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  omitir  text[] := ARRAY['firma', 'logo', 'updated_at'];
  viejo   jsonb;
  nuevo   jsonb;
  cambios jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    nuevo := to_jsonb(NEW) - omitir;
    INSERT INTO public.auditoria (usuario, tabla, registro_id, accion, cambios)
    VALUES (auth.uid(), TG_TABLE_NAME, nuevo->>'id', TG_OP, jsonb_build_object('nuevo', nuevo));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    viejo := to_jsonb(OLD) - omitir;
    INSERT INTO public.auditoria (usuario, tabla, registro_id, accion, cambios)
    VALUES (auth.uid(), TG_TABLE_NAME, viejo->>'id', TG_OP, jsonb_build_object('anterior', viejo));
    RETURN OLD;
  END IF;

  viejo := to_jsonb(OLD) - omitir;
  nuevo := to_jsonb(NEW) - omitir;
  SELECT jsonb_object_agg(k, jsonb_build_object('antes', viejo->k, 'despues', nuevo->k))
  INTO cambios
  FROM jsonb_object_keys(nuevo) AS k
  WHERE (viejo->k) IS DISTINCT FROM (nuevo->k);

  -- La firma no se guarda, pero que cambió sí
  IF to_jsonb(NEW) ? 'firma' AND (to_jsonb(NEW)->'firma') IS DISTINCT FROM (to_jsonb(OLD)->'firma') THEN
    cambios := COALESCE(cambios, '{}'::jsonb) || jsonb_build_object('firma', 'cambiada');
  END IF;

  IF cambios IS NOT NULL THEN
    INSERT INTO public.auditoria (usuario, tabla, registro_id, accion, cambios)
    VALUES (auth.uid(), TG_TABLE_NAME, nuevo->>'id', TG_OP, cambios);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes','solicitudes','servicios','albaranes','vehiculos',
    'mantenimientos','eventos','config','perfiles','deca'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria()', t);
  END LOOP;
END $$;


NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- COMPROBACIONES
--
--   -- Todas las cuentas con su rol (tienen que salir todas)
--   select u.email, p.rol, p.activo from auth.users u
--   left join public.perfiles p on p.id = u.id;
--
--   -- Un solo trigger de numeración en servicios
--   select tgname from pg_trigger where tgrelid = 'public.servicios'::regclass
--   and not tgisinternal;
--
--   -- Albaranes firmados, todos congelados
--   select numero, huella_sha256 is not null as congelado,
--          contenido_firmado ? 'retroactivo' as retroactivo
--   from public.albaranes where estado = 'firmado';
--
--   -- Ninguna política «todo con sesión» restante
--   select tablename, policyname from pg_policies
--   where schemaname = 'public' and qual = 'true';
-- ---------------------------------------------------------------------
