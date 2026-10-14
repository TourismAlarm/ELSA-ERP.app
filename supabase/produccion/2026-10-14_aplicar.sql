-- =====================================================================
-- APLICAR EN PRODUCCIÓN · 14/10/2026
-- Supabase → SQL Editor → pegar entero → Run.
--
-- Una sola transacción: si algo falla, no se aplica nada.
-- Contenido (migraciones del PR #72 y una pendiente desde el 09/10):
--   1. 20261009090000_quitar_calendario_ical   (no se llegó a aplicar)
--   2. 20261014120000_quitar_politicas_abiertas (los roles estaban anulados)
--   3. 20261014130000_albaran_pdf_emitido
--   4. 20261014140000_endurecer_funciones
--   5. Desactivar la cuenta de pruebas test@elsa.com
--   6. Registrar las versiones en supabase_migrations
-- Al final salen las comprobaciones: tienen que dar todo «ok».
-- =====================================================================
BEGIN;

-- ===================================================== 20261009090000_quitar_calendario_ical
-- Se retira la conexión con Google Calendar por enlaces iCal (direcciones
-- secretas pegadas a mano y el enlace iCal del ERP con token). Con la cuenta
-- de Google conectada (google_conexion), la app encuentra sola los
-- calendarios de la cuenta, lee sus eventos y escribe en ellos, así que ya
-- no hacen falta. Quitarlo también retira el enlace público con token, que
-- era una puerta más a los datos de clientes.
--
-- Idempotente.

DROP FUNCTION IF EXISTS public.calendario_publico(text);
DROP FUNCTION IF EXISTS public.regenerar_token_calendario();

ALTER TABLE public.config DROP COLUMN IF EXISTS ics_token;
ALTER TABLE public.config DROP COLUMN IF EXISTS google_ics_url;
ALTER TABLE public.config DROP COLUMN IF EXISTS google_calendarios;


-- ===================================================== 20261014120000_quitar_politicas_abiertas
-- Quita cualquier política «con sesión, todo» que haya vuelto a aparecer.
--
-- El 14/10/2026 se encontraron en producción las 11 políticas *_autenticados
-- (USING true) conviviendo con las de rol de la consolidación. Las políticas
-- de una tabla se suman con OR, así que con una sola abierta los roles no
-- sirven: un operario o una cuenta desactivada podía volver a tocarlo todo,
-- contadores y perfiles incluidos. Lo más probable es que se volviera a
-- ejecutar a mano 20260824180000_rls_todas_las_tablas (ya blindada).
--
-- No se borra por nombre sino por lo que hace: cualquier política de public
-- para authenticated o public cuya condición sea simplemente «true». Las de
-- rol (es_usuario_activo(), es_admin()) no se tocan, así que nadie pierde
-- acceso.
--
-- Idempotente.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles && ARRAY['authenticated', 'public']::name[]
      -- abierta para leer/modificar/borrar, o abierta para crear (INSERT
      -- solo tiene WITH CHECK)
      AND (qual = 'true' OR (qual IS NULL AND with_check = 'true'))
  LOOP
    RAISE NOTICE 'Quitando política abierta % en %', r.policyname, r.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;


-- Comprobación: no debe devolver ninguna fila.
--   select tablename, policyname from pg_policies
--   where schemaname = 'public' and (qual = 'true' or with_check = 'true');

-- ===================================================== 20261014130000_albaran_pdf_emitido
-- Conservar el PDF exacto que se entregó al firmar un albarán.
--
-- Hasta ahora, al firmar se congelaba el contenido (contenido_firmado + huella
-- SHA-256) y el PDF se regeneraba desde ahí cada vez. Eso garantiza los
-- datos, pero no el documento: cambia el logo, cambia la maqueta del PDF o la
-- fecha de impresión, y el fichero ya no es el que vio el cliente. Ahora, al
-- firmar, la app genera el PDF, lo guarda en un bucket privado y apunta su
-- ruta y su huella en el albarán.
--
-- Reglas (las aplica la base de datos, no la app):
--   · Se sube una sola vez, y solo para un albarán firmado que aún no tiene
--     PDF guardado. Nadie lo puede sobrescribir ni borrar desde la app.
--   · pdf_path / pdf_sha256 pasan de vacío a valor una vez y ya no cambian.
--   · Si la subida falla, el albarán sigue firmado (lo que vale es la firma)
--     y queda «PDF pendiente»: se puede reintentar desde la ficha.
--
-- Idempotente.

-- ------------------------------------------------------------- columnas
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS pdf_path        text;
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS pdf_sha256      text;
ALTER TABLE public.albaranes ADD COLUMN IF NOT EXISTS pdf_guardado_en timestamptz;

-- ------------------------------------------------------------- trigger
-- Igual que la versión de 20260929190000, más los tres campos del PDF en la
-- lista de lo que puede cambiar en un firmado, y la regla de «una sola vez».
CREATE OR REPLACE FUNCTION public.proteger_albaran()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  -- Lo único que puede cambiar en un firmado
  permitidos text[] := ARRAY['servicio_id','anulado','anulado_en','anulado_por','motivo_anulacion','updated_at',
                             'pdf_path','pdf_sha256','pdf_guardado_en'];
BEGIN
  -- ---- Ya estaba firmado: solo se puede anular, desvincular del servicio
  --      o registrar su PDF emitido (una vez)
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

    -- PDF emitido: de vacío a valor, una sola vez, en su carpeta
    IF NEW.pdf_path IS DISTINCT FROM OLD.pdf_path OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256 THEN
      IF OLD.pdf_path IS NOT NULL OR OLD.pdf_sha256 IS NOT NULL THEN
        RAISE EXCEPTION 'El PDF emitido del albarán % ya está guardado y no se puede cambiar.', OLD.numero;
      END IF;
      IF NEW.pdf_path IS NULL OR NEW.pdf_sha256 IS NULL
         OR NEW.pdf_path NOT LIKE OLD.id::text || '/%'
         OR NEW.pdf_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Datos del PDF emitido no válidos.';
      END IF;
      NEW.pdf_guardado_en := now();
    ELSIF NEW.pdf_guardado_en IS DISTINCT FROM OLD.pdf_guardado_en THEN
      RAISE EXCEPTION 'La fecha del PDF emitido no se puede cambiar.';
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
    -- Un borrador no lleva datos de firma, anulación ni PDF emitido colados
    NEW.contenido_firmado   := NULL;
    NEW.huella_sha256       := NULL;
    NEW.firmado_por_usuario := NULL;
    NEW.anulado := false; NEW.anulado_en := NULL; NEW.anulado_por := NULL; NEW.motivo_anulacion := NULL;
  END IF;
  -- El PDF emitido solo se registra después de firmar (rama de arriba)
  NEW.pdf_path := NULL; NEW.pdf_sha256 := NULL; NEW.pdf_guardado_en := NULL;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------- bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('albaranes-firmados', 'albaranes-firmados', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = 10485760,
      allowed_mime_types = ARRAY['application/pdf'];

-- Para la política de subida: ¿la carpeta corresponde a un albarán firmado
-- que todavía no tiene PDF? SECURITY DEFINER porque la política se evalúa en
-- storage y aquí hace falta leer albaranes sin depender de su RLS.
CREATE OR REPLACE FUNCTION public.albaran_admite_pdf(p_nombre text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.albaranes a
    WHERE a.id::text = split_part(p_nombre, '/', 1)
      AND a.estado = 'firmado'
      AND a.pdf_path IS NULL
  )
$$;
REVOKE ALL ON FUNCTION public.albaran_admite_pdf(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.albaran_admite_pdf(text) TO authenticated;

DROP POLICY IF EXISTS albaranes_pdf_leer  ON storage.objects;
DROP POLICY IF EXISTS albaranes_pdf_subir ON storage.objects;

CREATE POLICY albaranes_pdf_leer ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'albaranes-firmados' AND public.es_usuario_activo());

CREATE POLICY albaranes_pdf_subir ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'albaranes-firmados'
              AND public.es_usuario_activo()
              AND public.albaran_admite_pdf(name));

-- Sin políticas de UPDATE ni DELETE: desde la app no se puede sobrescribir
-- ni borrar un PDF emitido.


-- ===================================================== 20261014140000_endurecer_funciones
-- Cierra los avisos de seguridad de Supabase (advisors) del 14/10/2026.
--
--   · Funciones de trigger expuestas por la API (/rest/v1/rpc/...): solo
--     tienen sentido como triggers. Se revoca EXECUTE a todo el mundo; los
--     triggers siguen funcionando porque los ejecuta la propia base.
--   · Funciones sin search_path fijo: se fija a '' para que nadie pueda
--     colar otra tabla o función con el mismo nombre en otro esquema.
--
-- Idempotente.

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.proteger_albaran()', 'public.proteger_borrado_albaran()',
    'public.registrar_auditoria()', 'public.crear_perfil_de_usuario_nuevo()',
    'public.tocar_updated_at()', 'public.set_solicitud_numero()',
    'public.asignar_numero_servicio()', 'public.asignar_numero_albaran()',
    'public.asignar_numero_cliente()', 'public.asignar_numero_deca()'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    END IF;
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.next_numero(text, text)', 'public.set_solicitud_numero()',
    'public.asignar_numero_servicio()', 'public.asignar_numero_albaran()',
    'public.asignar_numero_cliente()', 'public.tocar_updated_at()',
    'public.proteger_borrado_albaran()', 'public.asignar_numero_deca()'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = %L', f, '');
    END IF;
  END LOOP;
END $$;


-- ===================================================== cuenta de pruebas
UPDATE public.perfiles SET activo = false
WHERE id = (SELECT id FROM auth.users WHERE email = 'test@elsa.com');

-- ===================================================== registro de versiones
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
      ('20261008090000', 'deca_storage_leer'),
      ('20261009090000', 'quitar_calendario_ical'),
      ('20261014120000', 'quitar_politicas_abiertas'),
      ('20261014130000', 'albaran_pdf_emitido'),
      ('20261014140000', 'endurecer_funciones')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- ===================================================== comprobaciones
SELECT 'sin políticas abiertas' AS comprobacion,
       CASE WHEN count(*) = 0 THEN 'ok' ELSE 'FALLA: ' || string_agg(tablename || '.' || policyname, ', ') END AS resultado
FROM pg_policies WHERE schemaname = 'public' AND (qual = 'true' OR (qual IS NULL AND with_check = 'true'))
UNION ALL
SELECT 'iCal retirado', CASE WHEN to_regprocedure('public.calendario_publico(text)') IS NULL THEN 'ok' ELSE 'FALLA' END
UNION ALL
SELECT 'bucket albaranes-firmados privado',
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'albaranes-firmados' AND NOT public) THEN 'ok' ELSE 'FALLA' END
UNION ALL
SELECT 'test@elsa.com desactivada',
       CASE WHEN NOT EXISTS (SELECT 1 FROM public.perfiles p JOIN auth.users u ON u.id = p.id
                             WHERE u.email = 'test@elsa.com' AND p.activo) THEN 'ok' ELSE 'FALLA' END
UNION ALL
SELECT 'admins activos', count(*)::text || ' (deben ser 2: gruaselsa y jordi)'
FROM public.perfiles WHERE rol = 'admin' AND activo;
