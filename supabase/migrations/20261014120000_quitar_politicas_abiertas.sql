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

NOTIFY pgrst, 'reload schema';

-- Comprobación: no debe devolver ninguna fila.
--   select tablename, policyname from pg_policies
--   where schemaname = 'public' and (qual = 'true' or with_check = 'true');
