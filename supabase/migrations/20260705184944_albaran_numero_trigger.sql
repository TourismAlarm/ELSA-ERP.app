-- Numeración de albaranes con el mismo criterio que solicitudes y servicios:
-- un trigger BEFORE INSERT calcula el siguiente número mirando la propia tabla
-- (MAX + 1), en la misma transacción del insert. Así un guardado fallido nunca
-- consume un número, y la app deja de llamar a la RPC next_numero.

CREATE OR REPLACE FUNCTION public.asignar_numero_albaran()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT COALESCE(MAX((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
    INTO next_num
    FROM public.albaranes
    WHERE numero ~ '^ALB-\d+$';
    NEW.numero := 'ALB-' || LPAD(next_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_albaran ON public.albaranes;
CREATE TRIGGER trg_asignar_numero_albaran
BEFORE INSERT ON public.albaranes
FOR EACH ROW
EXECUTE FUNCTION public.asignar_numero_albaran();
