-- =====================================================================
-- VUELTA ATRÁS de 20260929190000_consolidacion_permisos_integridad.sql
--
-- Solo si algo va mal DESPUÉS de aplicarla. Deja los permisos y el
-- comportamiento como estaban antes (todo el que tiene sesión puede con
-- todo; un albarán firmado se puede editar y borrar).
--
-- Qué NO deshace, a propósito (no molesta al código antiguo y borrarlo
-- perdería datos):
--   · Las columnas nuevas (nifCif, dirFact, contenido_firmado, huella...)
--     y lo que ya tengan escrito.
--   · La tabla auditoria y lo registrado.
--   · Las funciones nuevas (firmar_albaran, aceptar_solicitud...): sin
--     triggers ni políticas nuevas no cambian nada del código antiguo.
--   · Que los triggers de numeración sean SECURITY DEFINER.
--
-- Va todo en una transacción: o se deshace entero o no se toca nada.
-- Pegar entero en el SQL Editor y ejecutar.
-- =====================================================================

BEGIN;

-- ---- Triggers nuevos
DROP TRIGGER IF EXISTS trg_proteger_albaran         ON public.albaranes;
DROP TRIGGER IF EXISTS trg_proteger_borrado_albaran ON public.albaranes;
DROP TRIGGER IF EXISTS trg_crear_perfil             ON auth.users;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','solicitudes','servicios','albaranes','vehiculos',
                           'mantenimientos','eventos','config','perfiles','deca'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria  ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', t);
  END LOOP;
END $$;

-- ---- Políticas de tablas: fuera las nuevas, vuelven las «con sesión, todo»
DO $$
DECLARE r record; t text;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY['clientes','solicitudes','servicios','albaranes','vehiculos',
                                 'mantenimientos','eventos','config','contadores','perfiles','deca',
                                 '_solicitud_counter'])
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['clientes','solicitudes','servicios','albaranes','vehiculos',
                           'mantenimientos','eventos','config','contadores','perfiles','deca'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                   t || '_autenticados', t);
  END LOOP;
END $$;
CREATE POLICY solicitud_counter_autenticados ON public._solicitud_counter
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---- Storage: como lo dejaron 20260831120000 y 20260915105425
DROP POLICY IF EXISTS fotos_leer      ON storage.objects;
DROP POLICY IF EXISTS fotos_subir     ON storage.objects;
DROP POLICY IF EXISTS fotos_borrar    ON storage.objects;
DROP POLICY IF EXISTS deca_subir      ON storage.objects;
DROP POLICY IF EXISTS deca_actualizar ON storage.objects;
DROP POLICY IF EXISTS deca_borrar     ON storage.objects;

CREATE POLICY fotos_leer   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'service-photos');
CREATE POLICY fotos_subir  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'service-photos');
CREATE POLICY fotos_borrar ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'service-photos');
CREATE POLICY deca_subir      ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'deca-docs');
CREATE POLICY deca_actualizar ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'deca-docs') WITH CHECK (bucket_id = 'deca-docs');
CREATE POLICY deca_borrar     ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'deca-docs');

-- ---- Perfiles: las altas vuelven a nacer como antes
ALTER TABLE public.perfiles ALTER COLUMN rol SET DEFAULT 'admin';

-- ---- next_numero sin el freno de llamada directa (como antes)
CREATE OR REPLACE FUNCTION public.next_numero(p_clave text, p_prefijo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  n integer;
BEGIN
  UPDATE public.contadores
  SET next_number = next_number + 1, updated_at = now()
  WHERE clave = p_clave
  RETURNING next_number - 1 INTO n;
  IF n IS NULL THEN
    RAISE EXCEPTION 'No existe contador para la clave %', p_clave;
  END IF;
  RETURN p_prefijo || '-' || LPAD(n::text, GREATEST(3, length(n::text)), '0');
END;
$function$;

-- ---- Que conste que ya no está aplicada (así se puede volver a aplicar)
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260929190000';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Comprobación: tiene que salir una fila «_autenticados» por tabla y ningún
-- trigger trg_proteger_*:
--   select tablename, policyname from pg_policies where schemaname = 'public' order by 1;
--   select tgname from pg_trigger where tgrelid = 'public.albaranes'::regclass and not tgisinternal;
