-- Dónde se guardan los DeCA emitidos.
--
-- NOTA 29/09/2026: esta migración se aplicó en la base el 15/09 desde el
-- panel de Supabase pero nunca se subió al repositorio (hallazgo A1 del
-- informe de revisión). Se recupera aquí tal cual está registrada en
-- supabase_migrations.schema_migrations, con la misma versión, para que la
-- base se pueda reconstruir desde cero con el módulo DeCA completo.
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
-- Idempotente: se puede reejecutar sin romper nada.

-- ----------------------------------------------------------------- tabla
CREATE TABLE IF NOT EXISTS public.deca (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          text NOT NULL UNIQUE,
  servicio_id     uuid REFERENCES public.servicios(id) ON DELETE SET NULL,
  pdf_path        text,
  url             text,
  datos           jsonb NOT NULL DEFAULT '{}',
  anulado         boolean DEFAULT false,
  modificaciones  jsonb DEFAULT '[]',
  creado_en       timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deca_servicio_id ON public.deca(servicio_id);
CREATE INDEX IF NOT EXISTS idx_deca_creado_en   ON public.deca(creado_en);

-- ------------------------------------------------------------ numeración
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
ALTER TABLE public.deca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deca_autenticados ON public.deca;
CREATE POLICY deca_autenticados ON public.deca
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------- bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('deca-docs', 'deca-docs', true, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 5242880,
      allowed_mime_types = ARRAY['application/pdf'];

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

NOTIFY pgrst, 'reload schema';
