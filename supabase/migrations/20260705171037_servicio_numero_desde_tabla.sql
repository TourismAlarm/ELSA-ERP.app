-- El contador genérico next_numero('servicio', 'SRV') quedó desfasado y el
-- primer servicio real salió SRV-002. El trigger pasa a calcular el número
-- mirando la propia tabla (MAX + 1), sin depender de un contador aparte que
-- pueda desincronizarse.

-- Corregir el servicio existente numerado de más
UPDATE public.servicios SET numero = 'SRV-001' WHERE numero = 'SRV-002';

CREATE OR REPLACE FUNCTION public.asignar_numero_servicio()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT COALESCE(MAX((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
    INTO next_num
    FROM public.servicios
    WHERE numero ~ '^SRV-\d+$';
    NEW.numero := 'SRV-' || LPAD(next_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;
