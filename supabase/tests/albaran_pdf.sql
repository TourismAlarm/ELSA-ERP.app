-- PDF emitido del albarán: se registra una vez, solo en firmados, y no se
-- puede sobrescribir. Va después de permisos_e_integridad (usa sus cuentas).

\set ON_ERROR_STOP 1

CREATE OR REPLACE FUNCTION pg_temp.como(uid text) RETURNS void LANGUAGE sql AS
$$ SELECT set_config('request.jwt.claim.sub', uid, false) $$;

SET ROLE authenticated;
SELECT pg_temp.como('aaaaaaaa-0000-0000-0000-000000000002');  -- operario

DO $$
DECLARE
  a public.albaranes; b public.albaranes;
  huella text := repeat('a', 64);
  n int;
BEGIN
  INSERT INTO public.albaranes(cliente) VALUES ('PDF test') RETURNING * INTO b;

  -- Borrador: ni el PDF se registra ni se puede subir al bucket
  UPDATE public.albaranes SET pdf_path = b.id || '/x.pdf', pdf_sha256 = huella WHERE id = b.id;
  ASSERT (SELECT pdf_path FROM public.albaranes WHERE id = b.id) IS NULL, 'un borrador registra PDF emitido';
  BEGIN
    INSERT INTO storage.objects(bucket_id, name) VALUES ('albaranes-firmados', b.id || '/x.pdf');
    RAISE EXCEPTION 'SUBE PDF DE UN BORRADOR';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Firmado: se sube y se registra
  a := public.firmar_albaran(b.id, 'f', 'Ana');
  INSERT INTO storage.objects(bucket_id, name) VALUES ('albaranes-firmados', a.id || '/ALB.pdf');
  UPDATE public.albaranes SET pdf_path = a.id || '/ALB.pdf', pdf_sha256 = huella WHERE id = a.id;
  SELECT * INTO a FROM public.albaranes WHERE id = a.id;
  ASSERT a.pdf_path IS NOT NULL AND a.pdf_guardado_en IS NOT NULL, 'no se registra el PDF emitido';

  -- Ya registrado: no se puede cambiar…
  BEGIN
    UPDATE public.albaranes SET pdf_path = a.id || '/otro.pdf', pdf_sha256 = repeat('b', 64) WHERE id = a.id;
    RAISE EXCEPTION 'SE CAMBIA EL PDF EMITIDO';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'SE CAMBIA EL PDF EMITIDO' THEN RAISE; END IF;
  END;
  -- …ni subir otro fichero a su carpeta…
  BEGIN
    INSERT INTO storage.objects(bucket_id, name) VALUES ('albaranes-firmados', a.id || '/otro.pdf');
    RAISE EXCEPTION 'SUBE OTRO PDF';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- …ni borrar ni sobrescribir el que hay
  DELETE FROM storage.objects WHERE bucket_id = 'albaranes-firmados';
  GET DIAGNOSTICS n = ROW_COUNT;  ASSERT n = 0, 'se borra un PDF emitido';

  -- Ruta fuera de su carpeta o huella mal formada: rechazado
  INSERT INTO public.albaranes(cliente) VALUES ('PDF test 2') RETURNING * INTO b;
  b := public.firmar_albaran(b.id, 'f', 'Ana');
  BEGIN
    UPDATE public.albaranes SET pdf_path = a.id || '/ajeno.pdf', pdf_sha256 = huella WHERE id = b.id;
    RAISE EXCEPTION 'ACEPTA RUTA AJENA';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'ACEPTA RUTA AJENA' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

\echo 'OK: PDF emitido del albarán'
