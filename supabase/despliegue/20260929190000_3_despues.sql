-- =====================================================================
-- DESPUÉS de aplicar 20260929190000_consolidacion_permisos_integridad.sql
--
-- Solo lectura. Pegar entero en el SQL Editor y ejecutar. Todas las filas
-- tienen que salir con ok = 'SÍ' (las INFO se comparan con lo que dio
-- 20260929190000_1_antes.sql). Si alguna sale 'NO': vuelta atrás.
-- =====================================================================

SELECT * FROM (
  SELECT 1 AS n, 'Migración registrada' AS comprobacion,
         CASE WHEN count(*) = 1 THEN 'sí' ELSE 'no' END AS resultado,
         CASE WHEN count(*) = 1 THEN 'SÍ' ELSE 'NO' END AS ok
  FROM supabase_migrations.schema_migrations WHERE version = '20260929190000'

  UNION ALL
  SELECT 2, 'Cuentas sin perfil', count(*)::text,
         CASE WHEN count(*) = 0 THEN 'SÍ' ELSE 'NO' END
  FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = u.id)

  UNION ALL
  SELECT 3, 'Admins activos', count(*)::text,
         CASE WHEN count(*) > 0 THEN 'SÍ' ELSE 'NO' END
  FROM public.perfiles WHERE rol = 'admin' AND activo IS TRUE

  UNION ALL
  SELECT 4, 'Triggers de numeración en servicios',
         string_agg(tgname, ', '),
         CASE WHEN count(*) FILTER (WHERE tgname = 'trg_numero_servicio') = 0 THEN 'SÍ' ELSE 'NO' END
  FROM pg_trigger WHERE tgrelid = 'public.servicios'::regclass AND NOT tgisinternal AND tgname LIKE '%numero%'

  UNION ALL
  SELECT 5, 'Firmados sin congelar', count(*)::text,
         CASE WHEN count(*) = 0 THEN 'SÍ' ELSE 'NO' END
  FROM public.albaranes WHERE estado = 'firmado' AND (huella_sha256 IS NULL OR contenido_firmado IS NULL)

  UNION ALL
  SELECT 6, 'Políticas «con sesión, todo» en public',
         COALESCE(string_agg(tablename || '.' || policyname, ', '), 'ninguna'),
         CASE WHEN count(*) = 0 THEN 'SÍ' ELSE 'NO' END
  FROM pg_policies WHERE schemaname = 'public' AND (qual = 'true' OR with_check = 'true')

  UNION ALL
  SELECT 7, 'Tablas de public sin RLS',
         COALESCE(string_agg(tablename, ', '), 'ninguna'),
         CASE WHEN count(*) = 0 THEN 'SÍ' ELSE 'NO' END
  FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity

  UNION ALL
  SELECT 8, 'foto_albaran fuera del alcance de la API',
         'anon=' || has_function_privilege('anon', 'public.foto_albaran(public.albaranes)', 'EXECUTE')
         || ' authenticated=' || has_function_privilege('authenticated', 'public.foto_albaran(public.albaranes)', 'EXECUTE'),
         CASE WHEN NOT has_function_privilege('anon', 'public.foto_albaran(public.albaranes)', 'EXECUTE')
               AND NOT has_function_privilege('authenticated', 'public.foto_albaran(public.albaranes)', 'EXECUTE')
              THEN 'SÍ' ELSE 'NO' END

  UNION ALL
  SELECT 9, 'Operaciones: authenticated sí, anon no', string_agg(f || CASE
           WHEN has_function_privilege('authenticated', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')
           THEN ' bien' ELSE ' MAL' END, ', '),
         CASE WHEN bool_and(has_function_privilege('authenticated', f, 'EXECUTE')
                            AND NOT has_function_privilege('anon', f, 'EXECUTE')) THEN 'SÍ' ELSE 'NO' END
  FROM unnest(ARRAY[
    'public.firmar_albaran(uuid, text, text)',
    'public.emitir_albaran_de_servicio(uuid, time, time)',
    'public.aceptar_solicitud(uuid, date, time, time)',
    'public.anular_albaran(uuid, text)',
    'public.mi_rol()', 'public.next_numero(text, text)']) f

  UNION ALL
  SELECT 10, 'Triggers nuevos en albaranes',
         string_agg(tgname, ', ' ORDER BY tgname),
         CASE WHEN count(*) FILTER (WHERE tgname IN ('trg_proteger_albaran','trg_proteger_borrado_albaran','trg_auditoria','trg_updated_at')) = 4
              THEN 'SÍ' ELSE 'NO' END
  FROM pg_trigger WHERE tgrelid = 'public.albaranes'::regclass AND NOT tgisinternal

  UNION ALL
  SELECT 11, 'Tablas con auditoría (tienen que ser 10)', count(*)::text,
         CASE WHEN count(*) = 10 THEN 'SÍ' ELSE 'NO' END
  FROM pg_trigger WHERE tgname = 'trg_auditoria' AND NOT tgisinternal

  UNION ALL
  SELECT 12, 'Alta automática de perfil en auth.users',
         CASE WHEN count(*) = 1 THEN 'trg_crear_perfil' ELSE 'falta' END,
         CASE WHEN count(*) = 1 THEN 'SÍ' ELSE 'NO' END
  FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'trg_crear_perfil'

  UNION ALL
  SELECT 13, 'Contadores (comparar con la fila 11 de «antes»)',
         (SELECT string_agg(clave || '=' || next_number, ', ' ORDER BY clave) FROM public.contadores)
         || ', solicitud=' || (SELECT next_number FROM public._solicitud_counter WHERE id = 1),
         'INFO'

  UNION ALL
  SELECT 14, 'Cuentas y rol',
         string_agg(u.email || ' [' || p.rol || CASE WHEN p.activo IS FALSE THEN ', inactivo' ELSE '' END || ']', ', '),
         'INFO'
  FROM auth.users u JOIN public.perfiles p ON p.id = u.id
) x
ORDER BY n;
