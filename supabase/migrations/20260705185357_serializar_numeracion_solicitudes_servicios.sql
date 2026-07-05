-- Mismo refuerzo que en albaranes: serializar la asignación de número con un
-- advisory lock transaccional, para que dos inserts simultáneos no puedan leer
-- el mismo MAX y asignar el mismo número.

CREATE OR REPLACE FUNCTION public.set_solicitud_numero()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('solicitudes_numero'));
    SELECT COALESCE(MAX((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
    INTO next_num
    FROM public.solicitudes
    WHERE numero ~ '^S-\d+$';
    NEW.numero := 'S-' || LPAD(next_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.asignar_numero_servicio()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('servicios_numero'));
    SELECT COALESCE(MAX((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
    INTO next_num
    FROM public.servicios
    WHERE numero ~ '^SRV-\d+$';
    NEW.numero := 'SRV-' || LPAD(next_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;
