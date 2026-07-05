-- Numeración por contador persistente para solicitudes, servicios y albaranes.
-- Un contador solo sube: nunca reutiliza el número de una fila borrada
-- (inaceptable en documentos firmados). Semántica: next_number guarda el
-- PRÓXIMO número a asignar. El UPDATE bloquea la fila del contador, por lo
-- que dos inserts simultáneos quedan serializados.
-- Sustituye al enfoque MAX(numero)+1: aquel reutilizaba el número más alto
-- si se borraba esa fila.

-- 1) Redefinir next_numero con semántica explícita
CREATE OR REPLACE FUNCTION public.next_numero(p_clave text, p_prefijo text)
RETURNS text
LANGUAGE plpgsql
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
  -- GREATEST evita que LPAD trunque a partir del número 1000
  RETURN p_prefijo || '-' || LPAD(n::text, GREATEST(3, length(n::text)), '0');
END;
$function$;

-- 2) Sincronizar cada contador al máximo real + 1 (calculado, no fijo)
UPDATE public._solicitud_counter
SET next_number = (SELECT COALESCE(MAX((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
                   FROM public.solicitudes WHERE numero ~ '^S-\d+$'),
    updated_at = now()
WHERE id = 1;

UPDATE public.contadores
SET next_number = (SELECT COALESCE(MAX((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
                   FROM public.servicios WHERE numero ~ '^SRV-\d+$'),
    updated_at = now()
WHERE clave = 'servicio';

UPDATE public.contadores
SET next_number = (SELECT COALESCE(MAX((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
                   FROM public.albaranes WHERE numero ~ '^ALB-\d+$'),
    updated_at = now()
WHERE clave = 'albaran';

-- 3) Trigger de solicitudes: vuelve al contador _solicitud_counter
--    (adaptado a la misma semántica: next_number = próximo a asignar)
CREATE OR REPLACE FUNCTION public.set_solicitud_numero()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    UPDATE public._solicitud_counter
    SET next_number = next_number + 1, updated_at = now()
    WHERE id = 1
    RETURNING next_number - 1 INTO next_num;
    NEW.numero := 'S-' || LPAD(next_num::text, GREATEST(3, length(next_num::text)), '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_solicitud_numero ON public.solicitudes;
CREATE TRIGGER trg_set_solicitud_numero
BEFORE INSERT ON public.solicitudes
FOR EACH ROW
EXECUTE FUNCTION public.set_solicitud_numero();

-- 4) Trigger de servicios: vuelve al contador (clave 'servicio')
CREATE OR REPLACE FUNCTION public.asignar_numero_servicio()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero('servicio', 'SRV');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_servicio ON public.servicios;
CREATE TRIGGER trg_asignar_numero_servicio
BEFORE INSERT ON public.servicios
FOR EACH ROW
EXECUTE FUNCTION public.asignar_numero_servicio();

-- 5) Trigger de albaranes: contador (clave 'albaran'), nunca MAX sobre la tabla
CREATE OR REPLACE FUNCTION public.asignar_numero_albaran()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_numero('albaran', 'ALB');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_albaran ON public.albaranes;
CREATE TRIGGER trg_asignar_numero_albaran
BEFORE INSERT ON public.albaranes
FOR EACH ROW
EXECUTE FUNCTION public.asignar_numero_albaran();
