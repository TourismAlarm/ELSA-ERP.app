-- Anular un DeCA, con rastro, y que un DeCA emitido no se pueda tocar.
--
-- Hasta ahora la columna deca.anulado existía pero nada la escribía, y la
-- política de UPDATE (solo admin) dejaba a un admin cambiar CUALQUIER columna
-- por la API: la URL, el PDF, los datos congelados, o poner anulado = false.
-- Un DeCA es un documento que se enseña en un control: lo que dice no puede
-- cambiar después de emitido.
--
-- Qué hace esta migración:
--   · anular_deca(p_id, p_motivo): RPC solo para admin. Marca el DeCA como
--     anulado y añade a deca.modificaciones quién, cuándo y por qué.
--   · Un trigger que, en un DeCA ya emitido, solo deja cambiar anulado y
--     modificaciones, no deja reactivar un anulado y no deja borrar. Quién y
--     cuándo los pone el servidor, no el cliente.
--
-- Un DeCA no se borra nunca: la política de DELETE ya no existía (ver la
-- consolidación del 29/09) y el trigger lo impide también a quien se salte RLS.
-- El PDF sigue en el bucket y su URL sigue abierta tras anular (el fichero es
-- inmutable); lo que cambia es el registro.
--
-- Idempotente: se puede reejecutar sin romper nada.

CREATE OR REPLACE FUNCTION public.proteger_deca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- servicio_id solo puede pasar a NULL (ON DELETE SET NULL del servicio)
  permitidos text[] := ARRAY['anulado','modificaciones','servicio_id','updated_at'];
  antes   int;
  despues int;
  ultima  jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un DeCA no se borra nunca. Si hay un error, anúlalo y emite otro.';
  END IF;

  IF (to_jsonb(NEW) - permitidos) IS DISTINCT FROM (to_jsonb(OLD) - permitidos) THEN
    RAISE EXCEPTION 'El DeCA % ya está emitido y no se puede modificar. Si hay un error, anúlalo y emite otro.', OLD.numero;
  END IF;
  IF NEW.servicio_id IS DISTINCT FROM OLD.servicio_id AND NEW.servicio_id IS NOT NULL THEN
    RAISE EXCEPTION 'Un DeCA emitido no se puede vincular a otro servicio.';
  END IF;

  IF COALESCE(OLD.anulado, false) AND NOT COALESCE(NEW.anulado, false) THEN
    RAISE EXCEPTION 'Un DeCA anulado no se puede reactivar. Emite otro.';
  END IF;

  IF NOT COALESCE(OLD.anulado, false) AND COALESCE(NEW.anulado, false) THEN
    IF NOT public.es_admin() THEN
      RAISE EXCEPTION 'Solo administración puede anular un DeCA.';
    END IF;
    antes   := jsonb_array_length(COALESCE(OLD.modificaciones, '[]'::jsonb));
    despues := jsonb_array_length(COALESCE(NEW.modificaciones, '[]'::jsonb));
    ultima  := NEW.modificaciones -> (despues - 1);
    IF despues <> antes + 1
       OR NEW.modificaciones - (despues - 1) IS DISTINCT FROM COALESCE(OLD.modificaciones, '[]'::jsonb)
       OR COALESCE(btrim(ultima ->> 'motivo'), '') = '' THEN
      RAISE EXCEPTION 'Para anular un DeCA hay que indicar el motivo y dejar registro (usa anular_deca).';
    END IF;
    -- Quién y cuándo, del servidor: lo que mande el cliente aquí se ignora
    NEW.modificaciones := (NEW.modificaciones - (despues - 1)) || jsonb_build_array(jsonb_build_object(
      'accion',  'anulacion',
      'usuario', auth.uid(),
      'nombre',  (SELECT p.nombre FROM public.perfiles p WHERE p.id = auth.uid()),
      'cuando',  now(),
      'motivo',  btrim(ultima ->> 'motivo')
    ));
  ELSIF NEW.modificaciones IS DISTINCT FROM OLD.modificaciones THEN
    RAISE EXCEPTION 'El registro de modificaciones del DeCA solo cambia al anularlo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_deca ON public.deca;
-- «trg_p…» va antes de «trg_updated_at» y «trg_auditoria» (esta es AFTER)
CREATE TRIGGER trg_proteger_deca
BEFORE UPDATE OR DELETE ON public.deca
FOR EACH ROW EXECUTE FUNCTION public.proteger_deca();


CREATE OR REPLACE FUNCTION public.anular_deca(p_id uuid, p_motivo text)
RETURNS public.deca
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  d public.deca;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo administración puede anular un DeCA.';
  END IF;
  IF COALESCE(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Para anular un DeCA hay que indicar el motivo.';
  END IF;

  SELECT * INTO d FROM public.deca WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el DeCA o no tienes acceso.';
  END IF;
  IF COALESCE(d.anulado, false) THEN
    RAISE EXCEPTION 'El DeCA % ya está anulado.', d.numero;
  END IF;

  UPDATE public.deca
  SET anulado = true,
      modificaciones = COALESCE(modificaciones, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('accion', 'anulacion', 'motivo', btrim(p_motivo)))
  WHERE id = p_id
  RETURNING * INTO d;
  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_deca()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anular_deca(uuid, text)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anular_deca(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
