-- Activa RLS en todas las tablas de public. Estaban todas "Unrestricted"
-- salvo mantenimientos: como la anon key viaja dentro del JavaScript público
-- de la aplicación, cualquiera podía leer, escribir y borrar clientes,
-- solicitudes, servicios, albaranes firmados, configuración y flota.
--
-- Criterio: es un ERP interno de una sola empresa, así que todo el que tiene
-- sesión iniciada puede con todo, y quien no la tiene no puede con nada.
-- Es la misma política que ya tenía mantenimientos desde la migración
-- 20260706070547_flota_control_total.sql.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

-- BLINDAJE 14/10/2026: esta migración ya no hace nada si la base tiene los
-- roles de 20260929190000_consolidacion_permisos_integridad. Alguien la volvió
-- a ejecutar a mano en producción (seguramente al depurar un error de RLS del
-- DeCA el 08/10) y recreó las políticas «con sesión, todo». Como las
-- políticas se suman con OR, eso anulaba todos los permisos por rol.
DO $guard$
BEGIN
  IF to_regprocedure('public.es_admin()') IS NOT NULL THEN
    RAISE NOTICE 'rls_todas_las_tablas: la base ya tiene roles; no se toca nada.';
    RETURN;
  END IF;
  EXECUTE $q$
-- ---------------------------------------------------------------- datos
ALTER TABLE public.solicitudes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albaranes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solicitudes_autenticados ON public.solicitudes;
CREATE POLICY solicitudes_autenticados ON public.solicitudes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS servicios_autenticados ON public.servicios;
CREATE POLICY servicios_autenticados ON public.servicios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS albaranes_autenticados ON public.albaranes;
CREATE POLICY albaranes_autenticados ON public.albaranes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS clientes_autenticados ON public.clientes;
CREATE POLICY clientes_autenticados ON public.clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS vehiculos_autenticados ON public.vehiculos;
CREATE POLICY vehiculos_autenticados ON public.vehiculos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS config_autenticados ON public.config;
CREATE POLICY config_autenticados ON public.config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------ contadores
-- Los triggers que numeran solicitudes, servicios y albaranes son funciones
-- normales (no SECURITY DEFINER), así que el UPDATE del contador se ejecuta
-- con el rol de quien inserta. Sin política aquí, guardar cualquier documento
-- fallaría con "new row violates row-level security policy".
ALTER TABLE public.contadores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._solicitud_counter  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contadores_autenticados ON public.contadores;
CREATE POLICY contadores_autenticados ON public.contadores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS solicitud_counter_autenticados ON public._solicitud_counter;
CREATE POLICY solicitud_counter_autenticados ON public._solicitud_counter
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------- tablas sin usar
-- eventos y perfiles no las toca la aplicación. Se protegen igualmente:
-- una tabla olvidada y abierta es exactamente por donde entra un problema.
ALTER TABLE public.eventos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_autenticados ON public.eventos;
CREATE POLICY eventos_autenticados ON public.eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS perfiles_autenticados ON public.perfiles;
CREATE POLICY perfiles_autenticados ON public.perfiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Comprobación: esta consulta no debe devolver ninguna fila.
--   select tablename from pg_tables
--   where schemaname = 'public' and rowsecurity = false;
  $q$;
END $guard$;
