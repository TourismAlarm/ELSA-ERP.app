-- Pruebas de permisos e integridad. Se ejecutan en CI sobre una base recién
-- construida con todas las migraciones (NUNCA contra la base real: crea y
-- modifica datos). Cada bloque falla con un error si algo no se cumple.
--
-- Cubre los criterios de aceptación de la primera fase del informe de
-- revisión: un operario no toca configuración ni perfiles aunque llame a la
-- API directamente; un albarán firmado rechaza cambios y conserva lo
-- emitido; las operaciones encadenadas no se duplican.

\set ON_ERROR_STOP 1

INSERT INTO auth.users(id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'operario@test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'baja@test')
ON CONFLICT DO NOTHING;
UPDATE public.perfiles SET rol = 'admin'  WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
UPDATE public.perfiles SET activo = false WHERE id = 'aaaaaaaa-0000-0000-0000-000000000003';

CREATE OR REPLACE FUNCTION pg_temp.como(uid text) RETURNS void LANGUAGE sql AS
$$ SELECT set_config('request.jwt.claim.sub', uid, false) $$;

-- ------------------------------------------------------------ admin
SET ROLE authenticated;
SELECT pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');

DO $$
DECLARE
  cli uuid; sol uuid; srv public.servicios; alb public.albaranes; alb2 public.albaranes;
  n int; huella text;
BEGIN
  INSERT INTO public.config(id, nombre) VALUES (1, 'ELSA')
  ON CONFLICT (id) DO UPDATE SET nombre = 'ELSA';
  INSERT INTO public.clientes(nombre, "nifCif") VALUES ('Cliente Test', 'A11111111') RETURNING id INTO cli;
  INSERT INTO public.solicitudes(cliente, cliente_id, "nifCif") VALUES ('Cliente Test', cli, 'B22222222') RETURNING id INTO sol;

  -- Aceptar = servicio creado, y repetirlo no duplica
  srv := public.aceptar_solicitud(sol, '2026-10-01', '08:00', '10:00');
  PERFORM public.aceptar_solicitud(sol, '2026-10-01');
  SELECT count(*) INTO n FROM public.servicios WHERE solicitud_id = sol;
  ASSERT n = 1, 'aceptar_solicitud duplica servicios';
  ASSERT srv."nifCif" = 'B22222222', 'el NIF del documento no pasa al servicio';

  -- Emitir albarán = cliente_id copiado, servicio realizado, sin duplicar
  alb := public.emitir_albaran_de_servicio(srv.id, '08:30', '11:00');
  alb2 := public.emitir_albaran_de_servicio(srv.id);
  ASSERT alb.id = alb2.id, 'emitir_albaran_de_servicio duplica albaranes';
  ASSERT alb.cliente_id = cli, 'el albarán no guarda cliente_id';
  ASSERT (SELECT estado FROM public.servicios WHERE id = srv.id) = 'realizado', 'el servicio no queda realizado';

  -- Firmar = congelado con huella y hora del servidor
  alb := public.firmar_albaran(alb.id, 'data:image/png;base64,AAA', 'Pepe');
  ASSERT alb.estado = 'firmado' AND alb.huella_sha256 IS NOT NULL, 'la firma no congela el contenido';
  huella := alb.huella_sha256;

  -- Un firmado no se modifica…
  BEGIN
    UPDATE public.albaranes SET descripcion = 'otra cosa' WHERE id = alb.id;
    RAISE EXCEPTION 'SE PUDO MODIFICAR UN FIRMADO';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'SE PUDO MODIFICAR UN FIRMADO' THEN RAISE; END IF;
  END;
  -- …ni se borra
  BEGIN
    DELETE FROM public.albaranes WHERE id = alb.id;
    RAISE EXCEPTION 'SE PUDO BORRAR UN FIRMADO';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'SE PUDO BORRAR UN FIRMADO' THEN RAISE; END IF;
  END;
  -- …y cambiar la ficha del cliente no cambia lo firmado
  UPDATE public.clientes SET "nifCif" = 'CAMBIADO' WHERE id = cli;
  ASSERT (SELECT contenido_firmado->'cliente'->>'nifCif' FROM public.albaranes WHERE id = alb.id) = 'B22222222',
    'lo firmado cambia al cambiar la ficha';
  ASSERT (SELECT huella_sha256 FROM public.albaranes WHERE id = alb.id) = huella, 'la huella ha cambiado';

  -- Anular: con motivo, queda sellado
  alb := public.anular_albaran(alb.id, 'Horas mal puestas');
  ASSERT alb.anulado AND alb.anulado_por IS NOT NULL AND alb.anulado_en IS NOT NULL, 'anulación sin sello';

  ASSERT (SELECT count(*) FROM public.auditoria) > 0, 'la auditoría no registra nada';
END $$;
RESET ROLE;

-- ------------------------------------------------------------ operario
SET ROLE authenticated;
SELECT pg_temp.como('aaaaaaaa-0000-0000-0000-000000000002');

DO $$
DECLARE n int; a public.albaranes;
BEGIN
  SELECT count(*) INTO n FROM public.clientes;
  ASSERT n > 0, 'el operario no ve los clientes';

  UPDATE public.config SET nombre = 'HACK';
  GET DIAGNOSTICS n = ROW_COUNT;  ASSERT n = 0, 'el operario modifica la configuración';

  UPDATE public.perfiles SET rol = 'admin' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';
  GET DIAGNOSTICS n = ROW_COUNT;  ASSERT n = 0, 'el operario se sube a admin';

  UPDATE public.contadores SET next_number = 1;
  GET DIAGNOSTICS n = ROW_COUNT;  ASSERT n = 0, 'el operario toca los contadores';

  DELETE FROM public.servicios;
  GET DIAGNOSTICS n = ROW_COUNT;  ASSERT n = 0, 'el operario borra servicios';

  SELECT count(*) INTO n FROM public.auditoria;
  ASSERT n = 0, 'el operario lee la auditoría';

  -- Sí puede: crear servicio y albarán, y firmarlo
  INSERT INTO public.servicios(cliente) VALUES ('Obra X');
  INSERT INTO public.albaranes(cliente) VALUES ('Obra X') RETURNING * INTO a;
  a := public.firmar_albaran(a.id, 'f', 'Juan');
  ASSERT a.estado = 'firmado', 'el operario no puede firmar';

  -- No puede: anular
  BEGIN
    PERFORM public.anular_albaran(a.id, 'motivo');
    RAISE EXCEPTION 'EL OPERARIO ANULA';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'EL OPERARIO ANULA' THEN RAISE; END IF;
  END;

  -- Numeración: reservar el del DeCA sí; quemar números de albarán, no
  ASSERT public.next_numero('deca', 'DECA') LIKE 'DECA-%', 'el operario no puede reservar número de DeCA';
  BEGIN
    PERFORM public.next_numero('albaran', 'ALB');
    RAISE EXCEPTION 'SE QUEMAN NÚMEROS DE ALBARÁN';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'SE QUEMAN NÚMEROS DE ALBARÁN' THEN RAISE; END IF;
  END;

  -- Una foto de un albarán firmado no se borra; una suelta sí
  INSERT INTO storage.objects(bucket_id, name) VALUES
    ('service-photos', 'albaranes/x/firmada.jpg'), ('service-photos', 'albaranes/x/suelta.jpg');
  INSERT INTO public.albaranes(cliente, fotos)
    VALUES ('Obra Y', '[{"id":"1","path":"albaranes/x/firmada.jpg"}]') RETURNING * INTO a;
  PERFORM public.firmar_albaran(a.id, 'f', 'Juan');
  DELETE FROM storage.objects WHERE name = 'albaranes/x/firmada.jpg';
  GET DIAGNOSTICS n = ROW_COUNT;  ASSERT n = 0, 'se borra una foto de un albarán firmado';
  DELETE FROM storage.objects WHERE name = 'albaranes/x/suelta.jpg';
  GET DIAGNOSTICS n = ROW_COUNT;  ASSERT n = 1, 'no se puede borrar una foto suelta';
END $$;
RESET ROLE;

-- ------------------------------------------------------------ admin: anular un borrador
SET ROLE authenticated;
SELECT pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
DO $$
DECLARE a public.albaranes;
BEGIN
  INSERT INTO public.albaranes(cliente) VALUES ('Borrador') RETURNING * INTO a;
  BEGIN
    PERFORM public.anular_albaran(a.id, 'motivo');
    RAISE EXCEPTION 'SE ANULA UN BORRADOR';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'SE ANULA UN BORRADOR' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- ------------------------------------------------------------ desactivado y anónimo
SET ROLE authenticated;
SELECT pg_temp.como('aaaaaaaa-0000-0000-0000-000000000003');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.clientes) = 0, 'una cuenta desactivada ve datos';
  BEGIN
    PERFORM public.next_numero('deca', 'DECA');
    RAISE EXCEPTION 'UNA CUENTA DESACTIVADA RESERVA NÚMEROS';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'UNA CUENTA DESACTIVADA RESERVA NÚMEROS' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.clientes) = 0, 'anon ve datos';
  -- foto_albaran lee saltándose RLS: no puede estar al alcance de la API
  ASSERT NOT has_function_privilege('anon', 'public.foto_albaran(public.albaranes)', 'EXECUTE'),
    'anon puede ejecutar foto_albaran';
  ASSERT NOT has_function_privilege('authenticated', 'public.foto_albaran(public.albaranes)', 'EXECUTE'),
    'authenticated puede ejecutar foto_albaran';
END $$;
RESET ROLE;

\echo 'OK: permisos e integridad'
