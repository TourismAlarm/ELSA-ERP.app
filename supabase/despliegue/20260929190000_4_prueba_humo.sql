-- =====================================================================
-- PRUEBA DE HUMO en producción, sin dejar rastro
--
-- Hace el recorrido completo como si fuera la primera cuenta admin activa:
-- aceptar una solicitud, emitir el albarán, firmarlo, intentar editarlo y
-- borrarlo, y anularlo. Al final lanza un error A PROPÓSITO para que la
-- base deshaga TODO (no quedan solicitudes, albaranes ni números gastados).
--
-- Resultado correcto: un error que dice exactamente
--     PRUEBA DE HUMO OK (todo deshecho)
-- Cualquier otro error indica qué ha fallado (y tampoco deja nada).
-- =====================================================================

DO $$
DECLARE
  uid uuid;
  sol uuid;
  srv public.servicios;
  alb public.albaranes;
  vistos int;
BEGIN
  SELECT p.id INTO uid FROM public.perfiles p
  WHERE p.rol = 'admin' AND p.activo IS TRUE ORDER BY p.created_at LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'No hay ningún admin activo'; END IF;

  -- Actuar como esa cuenta, igual que una petición de la app
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO vistos FROM public.clientes;
  IF vistos = 0 THEN RAISE EXCEPTION 'El admin no ve clientes: revisar políticas'; END IF;

  INSERT INTO public.solicitudes(cliente) VALUES ('PRUEBA DE HUMO') RETURNING id INTO sol;
  srv := public.aceptar_solicitud(sol, CURRENT_DATE, '08:00', '09:00');
  alb := public.emitir_albaran_de_servicio(srv.id, '08:00', '09:30');
  alb := public.firmar_albaran(alb.id, 'data:image/png;base64,AAA', 'Prueba');
  IF alb.huella_sha256 IS NULL THEN RAISE EXCEPTION 'La firma no congela el contenido'; END IF;

  BEGIN
    UPDATE public.albaranes SET descripcion = 'cambio' WHERE id = alb.id;
    RAISE EXCEPTION 'MAL: se ha podido editar un firmado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'MAL:%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.albaranes WHERE id = alb.id;
    RAISE EXCEPTION 'MAL: se ha podido borrar un firmado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'MAL:%' THEN RAISE; END IF;
  END;

  alb := public.anular_albaran(alb.id, 'Prueba de humo');
  IF NOT alb.anulado THEN RAISE EXCEPTION 'No se ha anulado'; END IF;

  RAISE EXCEPTION 'PRUEBA DE HUMO OK (todo deshecho)';
END $$;
