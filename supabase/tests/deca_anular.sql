-- Anulación de DeCA. Se ejecuta en CI tras permisos_e_integridad.sql sobre una
-- base recién construida (NUNCA contra la base real: crea datos de prueba).

\set ON_ERROR_STOP 1

INSERT INTO auth.users(id, email) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'admin-deca@test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'operario-deca@test')
ON CONFLICT DO NOTHING;
UPDATE public.perfiles SET rol = 'admin', nombre = 'Admin Deca' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';

CREATE OR REPLACE FUNCTION pg_temp.como(uid text) RETURNS void LANGUAGE sql AS
$$ SELECT set_config('request.jwt.claim.sub', uid, false) $$;

-- Un DeCA de prueba (lo crea cualquier perfil activo)
SET ROLE authenticated;
SELECT pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
INSERT INTO public.deca (id, numero, pdf_path, url, datos)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'DECA-TEST-1', 'x.pdf', 'https://x/x.pdf', '{"a":1}');

DO $$
DECLARE d public.deca; ok boolean;
BEGIN
  -- Operario: no puede anular, ni por RPC ni tocando la tabla
  BEGIN PERFORM public.anular_deca('cccccccc-0000-0000-0000-000000000001', 'x'); RAISE EXCEPTION 'operario anuló';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'operario anuló' THEN RAISE; END IF; END;
  UPDATE public.deca SET anulado = true WHERE id = 'cccccccc-0000-0000-0000-000000000001';
  SELECT anulado INTO ok FROM public.deca WHERE id = 'cccccccc-0000-0000-0000-000000000001';
  IF ok THEN RAISE EXCEPTION 'operario anuló por UPDATE'; END IF;
  -- Nadie borra
  DELETE FROM public.deca WHERE id = 'cccccccc-0000-0000-0000-000000000001';
  IF NOT EXISTS (SELECT 1 FROM public.deca WHERE id = 'cccccccc-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'operario borró'; END IF;
END $$;

SELECT pg_temp.como('bbbbbbbb-0000-0000-0000-000000000001');
DO $$
DECLARE d public.deca; m jsonb;
BEGIN
  -- Motivo obligatorio
  BEGIN PERFORM public.anular_deca('cccccccc-0000-0000-0000-000000000001', '   '); RAISE EXCEPTION 'anuló sin motivo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'anuló sin motivo' THEN RAISE; END IF; END;

  -- Sin usar la RPC: cambiar datos, url, o anular sin rastro, se rechaza
  BEGIN UPDATE public.deca SET url = 'https://otra' WHERE id = 'cccccccc-0000-0000-0000-000000000001'; RAISE EXCEPTION 'cambió la url';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'cambió la url' THEN RAISE; END IF; END;
  BEGIN UPDATE public.deca SET anulado = true WHERE id = 'cccccccc-0000-0000-0000-000000000001'; RAISE EXCEPTION 'anuló sin rastro';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'anuló sin rastro' THEN RAISE; END IF; END;
  -- Ni inventarse el «quién» desde el cliente: el servidor lo sobrescribe
  UPDATE public.deca SET anulado = true,
    modificaciones = '[{"accion":"anulacion","motivo":"falso","usuario":"otro","cuando":"2000-01-01"}]'
  WHERE id = 'cccccccc-0000-0000-0000-000000000001';
  SELECT * INTO d FROM public.deca WHERE id = 'cccccccc-0000-0000-0000-000000000001';
  m := d.modificaciones -> 0;
  IF m ->> 'usuario' <> 'bbbbbbbb-0000-0000-0000-000000000001' OR (m ->> 'cuando')::timestamptz < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'el cliente pudo falsear quién/cuándo: %', m;
  END IF;
END $$;

-- Restablecer y anular por la vía normal
RESET ROLE;
ALTER TABLE public.deca DISABLE TRIGGER trg_proteger_deca;
UPDATE public.deca SET anulado = false, modificaciones = '[]' WHERE id = 'cccccccc-0000-0000-0000-000000000001';
ALTER TABLE public.deca ENABLE TRIGGER trg_proteger_deca;
SET ROLE authenticated;
SELECT pg_temp.como('bbbbbbbb-0000-0000-0000-000000000001');

DO $$
DECLARE d public.deca; m jsonb;
BEGIN
  d := public.anular_deca('cccccccc-0000-0000-0000-000000000001', '  Matrícula equivocada ');
  IF NOT d.anulado THEN RAISE EXCEPTION 'no quedó anulado'; END IF;
  IF jsonb_array_length(d.modificaciones) <> 1 THEN RAISE EXCEPTION 'rastro incorrecto: %', d.modificaciones; END IF;
  m := d.modificaciones -> 0;
  IF m ->> 'accion' <> 'anulacion' OR m ->> 'motivo' <> 'Matrícula equivocada'
     OR m ->> 'usuario' <> 'bbbbbbbb-0000-0000-0000-000000000001' OR m ->> 'nombre' <> 'Admin Deca'
     OR (m ->> 'cuando') IS NULL THEN
    RAISE EXCEPTION 'rastro incompleto: %', m;
  END IF;
  -- Doble anulación, reactivación y borrado: no
  BEGIN PERFORM public.anular_deca(d.id, 'otra vez'); RAISE EXCEPTION 'anuló dos veces';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'anuló dos veces' THEN RAISE; END IF; END;
  BEGIN UPDATE public.deca SET anulado = false WHERE id = d.id; RAISE EXCEPTION 'reactivó';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'reactivó' THEN RAISE; END IF; END;
  -- (sin política de DELETE, RLS lo deja en 0 filas sin error)
  DELETE FROM public.deca WHERE id = d.id;
  IF NOT EXISTS (SELECT 1 FROM public.deca WHERE id = d.id) THEN RAISE EXCEPTION 'borró'; END IF;
END $$;

-- Quien se salta RLS (propietario / service_role) tampoco borra: lo impide el trigger
RESET ROLE;
DO $$
BEGIN
  BEGIN DELETE FROM public.deca WHERE id = 'cccccccc-0000-0000-0000-000000000001'; RAISE EXCEPTION 'borró sin RLS';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'borró sin RLS' THEN RAISE; END IF; END;
END $$;

-- anon no puede llamar a la RPC
RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  BEGIN PERFORM public.anular_deca('cccccccc-0000-0000-0000-000000000001', 'x'); RAISE EXCEPTION 'anon anuló';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- Borrar el servicio de un DeCA (ON DELETE SET NULL) sigue funcionando y el
-- DeCA se conserva
DO $$
DECLARE s uuid; n int;
BEGIN
  INSERT INTO public.servicios (cliente) VALUES ('PRUEBA DECA') RETURNING id INTO s;
  INSERT INTO public.deca (numero, servicio_id, pdf_path, url) VALUES ('DECA-TEST-2', s, 'y.pdf', 'https://x/y.pdf');
  DELETE FROM public.servicios WHERE id = s;
  SELECT count(*) INTO n FROM public.deca WHERE numero = 'DECA-TEST-2' AND servicio_id IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'el DeCA no sobrevivió al borrado del servicio'; END IF;
END $$;

\echo 'deca_anular: OK'
