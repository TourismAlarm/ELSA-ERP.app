-- Error «new row violates row-level security policy» al emitir un DeCA.
--
-- El bucket deca-docs solo tenía políticas de INSERT/UPDATE/DELETE. Subir con
-- upsert (INSERT ... ON CONFLICT DO UPDATE) y borrar con remove() necesitan
-- además poder LEER la fila en storage.objects, y sin política de SELECT
-- Postgres lo rechaza como violación de RLS. La descarga pública del PDF no
-- pasa por aquí (el bucket es público), así que esto no expone nada nuevo.
--
-- Idempotente.

DROP POLICY IF EXISTS deca_leer ON storage.objects;
CREATE POLICY deca_leer ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deca-docs');
