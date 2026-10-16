-- Reproduce lo que pasó en producción el 08/10/2026: volver a ejecutar a mano
-- la migración antigua rls_todas_las_tablas. Ya no debe recrear ninguna
-- política «con sesión, todo», que anularía los roles.

\set ON_ERROR_STOP 1
\ir ../migrations/20260824180000_rls_todas_las_tablas.sql

DO $$
DECLARE abiertas text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO abiertas
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR (qual IS NULL AND with_check = 'true'));
  ASSERT abiertas IS NULL, 'Hay políticas abiertas que anulan los roles: ' || abiertas;
END $$;

\echo 'OK: sin políticas abiertas'
