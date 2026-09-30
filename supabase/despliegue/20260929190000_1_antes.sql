-- =====================================================================
-- ANTES de aplicar 20260929190000_consolidacion_permisos_integridad.sql
--
-- Solo lectura: no cambia nada. Pegar entero en el SQL Editor y ejecutar.
-- Devuelve una tabla «comprobación | resultado | ok». Todas las filas con
-- ok = 'SÍ' o 'INFO'. Si alguna sale 'NO', NO aplicar y revisar.
-- Guarda el resultado (captura o CSV): las filas INFO se comparan después.
-- =====================================================================

WITH
versiones_repo(v) AS (VALUES
  ('20260705164237'),('20260705171037'),('20260705171422'),('20260705190710'),
  ('20260706070547'),('20260706110757'),('20260706120353'),('20260707205826'),
  ('20260707210510'),('20260824180000'),('20260831120000'),('20260831160000'),
  ('20260831190000'),('20260902090000'),('20260902150000'),('20260909093053'),
  ('20260915063136'),('20260915104042'),('20260915105425'),('20260929084415')
),
-- Columnas que usan las funciones nuevas. PL/pgSQL no las comprueba al crear
-- la función, sino al ejecutarla: si falta una, la migración entra bien y
-- lo que falla es la primera firma en la app.
columnas(t, c) AS (VALUES
  ('albaranes','id'),('albaranes','numero'),('albaranes','fecha'),('albaranes','cliente'),
  ('albaranes','cliente_id'),('albaranes','descripcion'),('albaranes','lineas'),('albaranes','fotos'),
  ('albaranes','firma'),('albaranes','firmado_por'),('albaranes','firmado_en'),('albaranes','estado'),
  ('albaranes','servicio_id'),('albaranes','solicitud_id'),('albaranes','created_at'),('albaranes','updated_at'),
  ('clientes','numero'),('clientes','nombre'),('clientes','nombre_comercial'),('clientes','nifCif'),
  ('clientes','dirFact'),('clientes','cp'),('clientes','poblacion'),('clientes','provincia'),
  ('clientes','tel'),('clientes','movil'),('clientes','email'),('clientes','updated_at'),
  ('servicios','numero'),('servicios','cliente'),('servicios','cliente_id'),('servicios','telCliente'),
  ('servicios','emailCliente'),('servicios','vehiculo'),('servicios','origen'),('servicios','destino'),
  ('servicios','descripcion'),('servicios','notas_internas'),('servicios','precio'),('servicios','peso'),
  ('servicios','bultos'),('servicios','fecha_servicio'),('servicios','hora_inicio'),('servicios','hora_fin'),
  ('servicios','solicitud_id'),('servicios','estado'),('servicios','notas'),('servicios','created_at'),
  ('servicios','updated_at'),
  ('solicitudes','cliente'),('solicitudes','cliente_id'),('solicitudes','telCliente'),('solicitudes','emailCliente'),
  ('solicitudes','vehiculo'),('solicitudes','origen'),('solicitudes','destino'),('solicitudes','descripcion'),
  ('solicitudes','notas_internas'),('solicitudes','precio'),('solicitudes','peso'),('solicitudes','bultos'),
  ('solicitudes','estado'),('solicitudes','fecha_ultimo_contacto'),('solicitudes','updated_at'),
  ('config','nombre'),('config','nif'),('config','tel'),('config','email'),('config','direccion'),
  ('config','web'),('config','autorizacion_transporte'),('config','updated_at'),
  ('perfiles','nombre'),('perfiles','rol'),('perfiles','activo'),('perfiles','updated_at'),
  ('vehiculos','updated_at'),('eventos','updated_at'),('deca','updated_at'),('deca','pdf_path'),
  ('contadores','clave'),('contadores','next_number'),('contadores','updated_at'),
  ('_solicitud_counter','next_number'),('_solicitud_counter','updated_at')
),
tablas(t) AS (VALUES
  ('clientes'),('solicitudes'),('servicios'),('albaranes'),('vehiculos'),('mantenimientos'),
  ('eventos'),('config'),('contadores'),('perfiles'),('deca'),('_solicitud_counter')
)
SELECT * FROM (
  SELECT 1 AS n, 'Migraciones del repo registradas en la base' AS comprobacion,
         COALESCE('faltan: ' || string_agg(v, ', '), 'todas') AS resultado,
         CASE WHEN count(*) = 0 THEN 'SÍ' ELSE 'NO' END AS ok
  FROM versiones_repo WHERE v NOT IN (SELECT version FROM supabase_migrations.schema_migrations)

  UNION ALL
  SELECT 2, '20260929190000 todavía NO aplicada',
         CASE WHEN count(*) = 0 THEN 'no aplicada' ELSE 'YA APLICADA' END,
         CASE WHEN count(*) = 0 THEN 'SÍ' ELSE 'NO' END
  FROM supabase_migrations.schema_migrations WHERE version = '20260929190000'

  UNION ALL
  SELECT 3, 'Versiones en la base que no están en el repo',
         COALESCE(string_agg(version || ' ' || COALESCE(name, ''), ', '), 'ninguna'),
         CASE WHEN count(*) = 0 THEN 'SÍ' ELSE 'INFO' END
  FROM supabase_migrations.schema_migrations
  WHERE version NOT IN (SELECT v FROM versiones_repo) AND version <> '00000000000000'

  UNION ALL
  SELECT 4, 'Columnas que usan las funciones nuevas',
         COALESCE('faltan: ' || string_agg(t || '.' || c, ', '), 'todas'),
         CASE WHEN count(*) = 0 THEN 'SÍ' ELSE 'NO' END
  FROM columnas
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns ic
                    WHERE ic.table_schema = 'public' AND ic.table_name = t AND ic.column_name = c)

  UNION ALL
  SELECT 5, 'pgcrypto disponible',
         COALESCE(max(installed_version), 'no instalada (la migración la instala)'),
         CASE WHEN count(*) > 0 THEN 'SÍ' ELSE 'NO' END
  FROM pg_available_extensions WHERE name = 'pgcrypto'

  UNION ALL
  -- La migración BORRA todas las políticas de estas tablas y crea las nuevas.
  -- Revisa que aquí no salga ninguna que haga falta conservar.
  SELECT 6, 'Políticas actuales que se van a sustituir',
         string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname),
         'INFO'
  FROM pg_policies WHERE schemaname = 'public' AND tablename IN (SELECT t FROM tablas)

  UNION ALL
  SELECT 7, 'Políticas de Storage actuales',
         string_agg(policyname, ', ' ORDER BY policyname), 'INFO'
  FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'

  UNION ALL
  SELECT 8, 'Cuentas (todas quedarán admin)',
         count(*)::text || ': ' || string_agg(u.email || ' [' || COALESCE(p.rol, 'sin perfil')
                                  || CASE WHEN p.activo IS FALSE THEN ', inactivo' ELSE '' END || ']', ', '),
         'INFO'
  FROM auth.users u LEFT JOIN public.perfiles p ON p.id = u.id

  UNION ALL
  SELECT 9, 'Triggers propios sobre auth.users',
         COALESCE(string_agg(tgname, ', '), 'ninguno'), 'INFO'
  FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal

  UNION ALL
  SELECT 10, 'Albaranes firmados (se congelan como retroactivos)',
         count(*)::text, 'INFO'
  FROM public.albaranes WHERE estado = 'firmado'

  UNION ALL
  SELECT 11, 'Contadores (tienen que seguir igual después)',
         (SELECT string_agg(clave || '=' || next_number, ', ' ORDER BY clave) FROM public.contadores)
         || ', solicitud=' || (SELECT next_number FROM public._solicitud_counter WHERE id = 1),
         'INFO'

  UNION ALL
  SELECT 12, 'Filas por tabla', (
    SELECT string_agg(relname || '=' || n_live_tup, ', ' ORDER BY relname)
    FROM pg_stat_user_tables WHERE schemaname = 'public'), 'INFO'
) x
ORDER BY n;
