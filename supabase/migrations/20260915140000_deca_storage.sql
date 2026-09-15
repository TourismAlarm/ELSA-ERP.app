-- Dónde se guardan los DeCA emitidos.
--
-- A partir del 5 de octubre de 2026 hay que emitir un DeCA (documento
-- electrónico de control administrativo) antes de iniciar cada transporte
-- público de mercancías. La fase anterior (servicio_datos_deca) guardó en el
-- servicio los datos que ese documento exige. Esta crea la tabla y el bucket
-- donde vivirán los documentos ya emitidos.
--
-- Lo que la norma pide y que condiciona el diseño:
--   · Cada DeCA tiene una URL única que empieza por https y descarga el PDF
--     directamente, sin credenciales ni sesión: por eso el bucket es PÚBLICO,
--     al contrario que service-photos, que es privado a propósito.
--   · El PDF lleva dentro un QR que apunta a esa misma URL.
--   · Queda registro de la fecha y hora de creación y de cada modificación.
--   · Se conserva un año como mínimo: por eso servicio_id es ON DELETE SET
--     NULL y no CASCADE. Si se borra el servicio, el DeCA emitido sigue
--     existiendo, igual que pasa con los albaranes.
--
-- Esta migración NO genera PDFs ni QR; eso es la fase siguiente. Aquí solo se
-- crea la estructura.
--
-- Idempotente: se puede reejecutar sin romper nada.

-- ----------------------------------------------------------------- tabla
CREATE TABLE IF NOT EXISTS public.deca (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          text NOT NULL UNIQUE,                                    -- DECA-XXX, lo asigna el trigger
  servicio_id     uuid REFERENCES public.servicios(id) ON DELETE SET NULL, -- el DeCA sobrevive al servicio
  pdf_path        text,                                                    -- ruta dentro del bucket deca-docs
  url             text,                                                    -- URL pública completa, la que va en el QR
  -- Copia CONGELADA de lo que se imprimió: NIF de la empresa, cliente,
  -- matrículas, mercancía... Si mañana cambian los datos de config o del
  -- cliente, el DeCA de hace tres meses tiene que seguir diciendo lo que
  -- decía el día que se emitió. Por eso no se vuelve a leer de config,
  -- clientes ni servicios: se guarda aquí tal cual salió en el PDF.
  datos           jsonb NOT NULL DEFAULT '{}',
  anulado         boolean DEFAULT false,
  -- Registro de cada modificación: [{ fecha, quien, cambios }, ...]
  modificaciones  jsonb DEFAULT '[]',
  creado_en       timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deca_servicio_id ON public.deca(servicio_id);
CREATE INDEX IF NOT EXISTS idx_deca_creado_en   ON public.deca(creado_en);

-- ------------------------------------------------------------ numeración
-- Mismo mecanismo que servicios (SRV-XXX) y albaranes (ALB-XXX): contador
-- persistente que solo sube y next_numero, que ya existe. Nunca MAX+1.
INSERT INTO public.contadores (clave, next_number) VALUES ('deca', 1)
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.asignar_numero_deca()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero('deca', 'DECA');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_deca ON public.deca;
CREATE TRIGGER trg_asignar_numero_deca
BEFORE INSERT ON public.deca
FOR EACH ROW
EXECUTE FUNCTION public.asignar_numero_deca();

-- ------------------------------------------------------------------- RLS
-- Mismo criterio que el resto de tablas: quien tiene sesión iniciada puede
-- con todo, quien no la tiene no puede con nada. La lectura pública del
-- documento va por el bucket, no por esta tabla.
ALTER TABLE public.deca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deca_autenticados ON public.deca;
CREATE POLICY deca_autenticados ON public.deca
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------- bucket
-- PÚBLICO a propósito (ver arriba): la URL del DeCA tiene que abrirse sin
-- sesión iniciada. Solo PDF y 5 MB como máximo, que es el tope de la norma.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('deca-docs', 'deca-docs', true, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 5242880,
      allowed_mime_types = ARRAY['application/pdf'];

-- Escribir, sustituir y borrar solo con sesión iniciada. Leer no necesita
-- política: el bucket es público.
DROP POLICY IF EXISTS deca_subir      ON storage.objects;
DROP POLICY IF EXISTS deca_actualizar ON storage.objects;
DROP POLICY IF EXISTS deca_borrar     ON storage.objects;

CREATE POLICY deca_subir ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deca-docs');

CREATE POLICY deca_actualizar ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deca-docs')
  WITH CHECK (bucket_id = 'deca-docs');

CREATE POLICY deca_borrar ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deca-docs');

-- PostgREST cachea el esquema: sin esto la tabla nueva no existe para la API
-- hasta que refresque solo
NOTIFY pgrst, 'reload schema';

-- Comprobación:
--   select * from public.contadores where clave = 'deca';           -- una fila
--   select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'deca-docs';                    -- public = true
--   select policyname from pg_policies where tablename = 'deca';    -- deca_autenticados
