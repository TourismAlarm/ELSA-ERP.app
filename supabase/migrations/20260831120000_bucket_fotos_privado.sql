-- Crea el almacén de fotos. Nunca llegó a existir: PHOTO_SETUP.md daba las
-- instrucciones pero no se siguieron, así que adjuntar una foto fallaba
-- siempre con "Bucket not found".
--
-- Se crea PRIVADO, al contrario de lo que decía aquella guía. Son fotos de
-- trabajos en casa de clientes: con el bucket público cualquiera con la anon
-- key (que va dentro del JavaScript de la aplicación) podría listarlas y
-- verlas todas. La aplicación firma la URL de cada foto al mostrarla, con una
-- hora de caducidad.
--
-- Como no había ni una sola foto guardada, no hay nada que migrar.
--
-- Idempotente: se puede reejecutar sin romper nada.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('service-photos', 'service-photos', false, 15728640) -- 15 MB
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 15728640;

-- Mismo criterio que las tablas: quien tiene sesión iniciada puede con todo,
-- quien no la tiene no puede con nada.
DROP POLICY IF EXISTS fotos_leer   ON storage.objects;
DROP POLICY IF EXISTS fotos_subir  ON storage.objects;
DROP POLICY IF EXISTS fotos_borrar ON storage.objects;

CREATE POLICY fotos_leer ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'service-photos');

CREATE POLICY fotos_subir ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-photos');

CREATE POLICY fotos_borrar ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'service-photos');

-- Comprobación: debe devolver una fila con public = false
--   select id, public, file_size_limit from storage.buckets;
