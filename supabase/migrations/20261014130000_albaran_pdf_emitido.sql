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

NOTIFY pgrst, 'reload schema';
