-- =====================================================================
-- ESQUEMA BASE DE ELSA-ERP
--
-- Volcado del estado real de la Supabase Elsa-ERP-dev (sessuuknaxfrgqkeypcg)
-- a 14 de septiembre de 2026.
--
-- POR QUÉ EXISTE ESTE FICHERO
-- Hasta ahora las migraciones del repo eran casi todas ALTER TABLE: las
-- tablas se habían creado a mano en el SQL Editor y no existía el CREATE
-- TABLE de servicios, albaranes, vehiculos, contadores ni perfiles. Es
-- decir: no había forma de levantar la base desde cero.
--
-- Este fichero se numera 00000000000000 para que quede POR DELANTE de
-- todas las migraciones existentes: primero crea el esquema, y luego las
-- migraciones posteriores lo modifican como siempre.
--
-- Es idempotente: se puede ejecutar sobre la base actual sin romper nada.
-- Ejecutarlo ahí es, de hecho, la forma de comprobar que no tiene erratas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLAS
--    En orden de dependencias: quien es referenciado, primero.
-- ---------------------------------------------------------------------

-- Clientes. nifCif y dirFact van en camelCase entrecomillado por herencia
-- del formulario original; el resto de columnas son snake_case.
CREATE TABLE IF NOT EXISTS public.clientes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL,
  "nifCif"          text,
  "dirFact"         text,
  tel               text,
  movil             text,
  email             text,
  cp                text,
  poblacion         text,
  provincia         text,
  nombre_comercial  text,
  numero            text,           -- código con el que está dado de alta en Factusol
  codigo_factusol   integer,        -- DEPRECADO: 0 filas lo usan, lo sustituyó "numero"
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Solicitudes (presupuestos). Numeración S-XXX por trigger.
CREATE TABLE IF NOT EXISTS public.solicitudes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                 text NOT NULL UNIQUE,
  cliente                text NOT NULL,
  cliente_id             uuid REFERENCES public.clientes(id),
  vehiculo               text,                    -- nombres separados por comas
  origen                 text,
  destino                text,
  descripcion            text,
  metros                 numeric,
  peso                   numeric,
  bultos                 integer,
  precio                 numeric,
  fotos                  jsonb DEFAULT '[]'::jsonb,
  estado                 text DEFAULT 'pendiente'::text,
  fecha_ultimo_contacto  timestamptz DEFAULT now(),
  notas_seguimiento      jsonb DEFAULT '[]'::jsonb,
  avisos_activos         boolean DEFAULT true,
  "formaPago"            text,
  observaciones          text,
  notas_internas         text,                    -- maniobra: NO sale en ningún documento
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- Servicios (trabajos programados). Numeración SRV-XXX por trigger.
CREATE TABLE IF NOT EXISTS public.servicios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          text NOT NULL UNIQUE,
  cliente         text NOT NULL,
  cliente_id      uuid REFERENCES public.clientes(id),
  solicitud_id    uuid REFERENCES public.solicitudes(id),
  vehiculo        text,                           -- nombres separados por comas
  origen          text,
  destino         text,
  descripcion     text,
  fecha_servicio  date DEFAULT CURRENT_DATE,
  hora_inicio     time,
  hora_fin        time,
  precio          numeric,
  fotos           jsonb DEFAULT '[]'::jsonb,
  estado          text DEFAULT 'abierto'::text,   -- abierto | realizado
  notas           jsonb DEFAULT '[]'::jsonb,
  notas_internas  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Albaranes (partes de trabajo firmados). Numeración ALB-XXX por trigger.
CREATE TABLE IF NOT EXISTS public.albaranes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        text NOT NULL UNIQUE,
  cliente       text NOT NULL,
  cliente_id    uuid REFERENCES public.clientes(id),
  servicio_id   uuid REFERENCES public.servicios(id),
  solicitud_id  uuid REFERENCES public.solicitudes(id),
  fecha         date DEFAULT CURRENT_DATE,
  descripcion   text,
  lineas        jsonb DEFAULT '[]'::jsonb,        -- [{concepto, cantidad, observaciones}]
  firma         text,                             -- imagen en base64
  firmado_por   text,
  firmado_en    timestamptz,
  estado        text DEFAULT 'borrador'::text,    -- borrador | firmado
  fotos         jsonb DEFAULT '[]'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Flota.
CREATE TABLE IF NOT EXISTS public.vehiculos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              text NOT NULL,
  matricula           text,
  tipo                text,
  itv_vencimiento     date,
  seguro_vencimiento  date,
  vencimientos        jsonb DEFAULT '[]'::jsonb,  -- [{nombre, fecha}]
  activo              boolean DEFAULT true,
  notas               text,
  fotos               jsonb DEFAULT '[]'::jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mantenimientos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id  uuid NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  fecha        date,
  descripcion  text,
  taller       text,
  coste        numeric,
  km           numeric,
  created_at   timestamptz DEFAULT now()
);

-- Eventos del calendario que no son servicios.
CREATE TABLE IF NOT EXISTS public.eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text NOT NULL,
  tipo         text NOT NULL DEFAULT 'otro'::text, -- visita|ausencia|taller|aviso|otro
  fecha        date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin    date,
  hora_inicio  time,
  hora_fin     time,
  todo_el_dia  boolean DEFAULT false,
  color        text,
  vehiculo_id  uuid REFERENCES public.vehiculos(id) ON DELETE SET NULL,
  notas        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Configuración de la empresa. Fila única id = 1.
CREATE TABLE IF NOT EXISTS public.config (
  id               integer PRIMARY KEY,
  nombre           text,
  tel              text,
  email            text,
  direccion        text,
  logo             text,
  vehicles         jsonb,                          -- [{nombre, color}]
  "workTypes"      jsonb,                          -- DEPRECADO: nadie lo lee desde abril
  "adminWhatsapp"  text,
  "adminEmail"     text,
  contractacion    text,
  web              text,
  "formaPago"      text,
  observaciones    text,
  conformidad      text,
  legal            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Contadores de numeración. next_number = PRÓXIMO número a asignar.
-- Solo suben: nunca reutilizan el número de una fila borrada.
CREATE TABLE IF NOT EXISTS public.contadores (
  clave        text PRIMARY KEY,                   -- servicio | albaran | cliente
  next_number  integer DEFAULT 1,
  updated_at   timestamptz DEFAULT now()
);

-- Contador propio de solicitudes. No se unificó con "contadores" en su día;
-- queda pendiente de fusionar.
CREATE TABLE IF NOT EXISTS public._solicitud_counter (
  id           integer PRIMARY KEY DEFAULT 1,
  next_number  integer DEFAULT 1,
  updated_at   timestamptz DEFAULT now()
);

-- Usuarios y roles. Creada pero todavía sin usar por la aplicación.
CREATE TABLE IF NOT EXISTS public.perfiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      text,
  rol         text NOT NULL DEFAULT 'admin'::text
              CHECK (rol IN ('admin', 'operario')),
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);


-- ---------------------------------------------------------------------
-- 2. ÍNDICES
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_clientes_nombre           ON public.clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre_comercial ON public.clientes(nombre_comercial);
CREATE INDEX IF NOT EXISTS idx_clientes_numero           ON public.clientes(numero);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_codigo_factusol
  ON public.clientes(codigo_factusol) WHERE codigo_factusol IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_numero     ON public.solicitudes(numero);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente    ON public.solicitudes(cliente);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente_id ON public.solicitudes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado     ON public.solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_created_at ON public.solicitudes(created_at);

CREATE INDEX IF NOT EXISTS idx_servicios_numero     ON public.servicios(numero);
CREATE INDEX IF NOT EXISTS idx_servicios_cliente    ON public.servicios(cliente);
CREATE INDEX IF NOT EXISTS idx_servicios_cliente_id ON public.servicios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servicios_estado     ON public.servicios(estado);
CREATE INDEX IF NOT EXISTS idx_servicios_fecha      ON public.servicios(fecha_servicio);

CREATE INDEX IF NOT EXISTS idx_albaranes_numero     ON public.albaranes(numero);
CREATE INDEX IF NOT EXISTS idx_albaranes_cliente    ON public.albaranes(cliente);
CREATE INDEX IF NOT EXISTS idx_albaranes_cliente_id ON public.albaranes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_albaranes_estado     ON public.albaranes(estado);
CREATE INDEX IF NOT EXISTS idx_albaranes_fecha      ON public.albaranes(fecha);

CREATE INDEX IF NOT EXISTS idx_vehiculos_nombre   ON public.vehiculos(nombre);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha      ON public.eventos(fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha_fin  ON public.eventos(fecha_fin);


-- ---------------------------------------------------------------------
-- 3. FUNCIONES DE NUMERACIÓN
-- ---------------------------------------------------------------------

-- Contador genérico. El UPDATE bloquea la fila, así que dos inserts
-- simultáneos quedan serializados y nunca cogen el mismo número.
CREATE OR REPLACE FUNCTION public.next_numero(p_clave text, p_prefijo text)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  n integer;
BEGIN
  UPDATE public.contadores
  SET next_number = next_number + 1, updated_at = now()
  WHERE clave = p_clave
  RETURNING next_number - 1 INTO n;
  IF n IS NULL THEN
    RAISE EXCEPTION 'No existe contador para la clave %', p_clave;
  END IF;
  -- GREATEST evita que LPAD trunque a partir del número 1000
  RETURN p_prefijo || '-' || LPAD(n::text, GREATEST(3, length(n::text)), '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_solicitud_numero()
RETURNS trigger
LANGUAGE plpgsql
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
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero('albaran', 'ALB');
  END IF;
  RETURN NEW;
END;
$function$;

-- El número de cliente puesto a mano o traído de Factusol se respeta, y
-- empuja el contador por encima para que las altas siguientes no choquen.
CREATE OR REPLACE FUNCTION public.asignar_numero_cliente()
RETURNS trigger
LANGUAGE plpgsql
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

-- NOTA: en la base actual existe además una función public.next_solicitud_numero()
-- que NO se reproduce aquí a propósito. Es el RPC original, ya no la llama nadie,
-- y tiene el error de off-by-one que provocó el SRV-002 de julio. Al recrear el
-- esquema desde cero no debe volver a existir.


-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_set_solicitud_numero ON public.solicitudes;
CREATE TRIGGER trg_set_solicitud_numero
BEFORE INSERT ON public.solicitudes
FOR EACH ROW EXECUTE FUNCTION public.set_solicitud_numero();

-- OJO: en la base actual hay DOS triggers sobre servicios haciendo lo mismo
-- (trg_numero_servicio y trg_asignar_numero_servicio). No revienta porque el
-- segundo se encuentra NEW.numero ya relleno, pero es un campo de minas. Aquí
-- se deja uno solo, y el duplicado se retira en su propia migración.
DROP TRIGGER IF EXISTS trg_asignar_numero_servicio ON public.servicios;
CREATE TRIGGER trg_asignar_numero_servicio
BEFORE INSERT ON public.servicios
FOR EACH ROW EXECUTE FUNCTION public.asignar_numero_servicio();

DROP TRIGGER IF EXISTS trg_asignar_numero_albaran ON public.albaranes;
CREATE TRIGGER trg_asignar_numero_albaran
BEFORE INSERT ON public.albaranes
FOR EACH ROW EXECUTE FUNCTION public.asignar_numero_albaran();

DROP TRIGGER IF EXISTS trg_asignar_numero_cliente ON public.clientes;
CREATE TRIGGER trg_asignar_numero_cliente
BEFORE INSERT ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.asignar_numero_cliente();


-- ---------------------------------------------------------------------
-- 5. FILAS SEMILLA
--    Sin ellas los triggers fallan al insertar el primer documento.
-- ---------------------------------------------------------------------

INSERT INTO public.contadores (clave, next_number) VALUES
  ('servicio', 1), ('albaran', 1), ('cliente', 1)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public._solicitud_counter (id, next_number) VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
--    ERP interno de una empresa: con sesión se puede con todo, sin ella
--    no se puede con nada. La anon key viaja en el JavaScript público,
--    así que sin esto la base está abierta a cualquiera.
-- ---------------------------------------------------------------------

ALTER TABLE public.clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albaranes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mantenimientos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contadores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._solicitud_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles           ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes','solicitudes','servicios','albaranes','vehiculos',
    'mantenimientos','eventos','config','contadores','perfiles'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_autenticados', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_autenticados', t
    );
  END LOOP;
END $$;

-- El contador de solicitudes tiene el nombre de política heredado, distinto
-- del patrón de arriba. Los triggers no son SECURITY DEFINER, así que sin
-- esta política guardar una solicitud falla con "violates row-level security".
DROP POLICY IF EXISTS solicitud_counter_autenticados ON public._solicitud_counter;
CREATE POLICY solicitud_counter_autenticados ON public._solicitud_counter
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- 7. STORAGE
--    Bucket PRIVADO: son fotos de trabajos en casa de clientes y la anon
--    key es pública. La aplicación firma la URL de cada foto al mostrarla.
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('service-photos', 'service-photos', false, 15728640)  -- 15 MB
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 15728640;

DROP POLICY IF EXISTS fotos_leer   ON storage.objects;
DROP POLICY IF EXISTS fotos_subir  ON storage.objects;
DROP POLICY IF EXISTS fotos_borrar ON storage.objects;

CREATE POLICY fotos_leer ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'service-photos');

CREATE POLICY fotos_subir ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-photos');

CREATE POLICY fotos_borrar ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'service-photos');


NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- COMPROBACIONES
--
--   -- Ninguna tabla sin RLS: no debe devolver filas
--   select tablename from pg_tables
--   where schemaname = 'public' and rowsecurity = false;
--
--   -- Los cuatro contadores existen
--   select * from public.contadores;
--   select * from public._solicitud_counter;
--
--   -- Un solo trigger de numeración por tabla
--   select tgrelid::regclass as tabla, tgname from pg_trigger
--   where not tgisinternal and tgrelid::regclass::text in
--     ('solicitudes','servicios','albaranes','clientes');
-- ---------------------------------------------------------------------
