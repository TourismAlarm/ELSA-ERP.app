-- Cierra los avisos de seguridad de Supabase (advisors) del 14/10/2026.
--
--   · Funciones de trigger expuestas por la API (/rest/v1/rpc/...): solo
--     tienen sentido como triggers. Se revoca EXECUTE a todo el mundo; los
--     triggers siguen funcionando porque los ejecuta la propia base.
--   · Funciones sin search_path fijo: se fija a '' para que nadie pueda
--     colar otra tabla o función con el mismo nombre en otro esquema.
--
-- Idempotente.

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.proteger_albaran()', 'public.proteger_borrado_albaran()',
    'public.registrar_auditoria()', 'public.crear_perfil_de_usuario_nuevo()',
    'public.tocar_updated_at()', 'public.set_solicitud_numero()',
    'public.asignar_numero_servicio()', 'public.asignar_numero_albaran()',
    'public.asignar_numero_cliente()', 'public.asignar_numero_deca()'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    END IF;
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.next_numero(text, text)', 'public.set_solicitud_numero()',
    'public.asignar_numero_servicio()', 'public.asignar_numero_albaran()',
    'public.asignar_numero_cliente()', 'public.tocar_updated_at()',
    'public.proteger_borrado_albaran()', 'public.asignar_numero_deca()'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = %L', f, '');
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
