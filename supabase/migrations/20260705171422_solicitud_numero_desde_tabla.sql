-- Unifica el criterio de numeración con servicios: el trigger de solicitudes
-- calcula el siguiente número mirando la propia tabla (MAX + 1) en vez de
-- depender de _solicitud_counter, que puede desincronizarse.

CREATE OR REPLACE FUNCTION public.set_solicitud_numero()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT COALESCE(MAX((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
    INTO next_num
    FROM public.solicitudes
    WHERE numero ~ '^S-\d+$';
    NEW.numero := 'S-' || LPAD(next_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;
