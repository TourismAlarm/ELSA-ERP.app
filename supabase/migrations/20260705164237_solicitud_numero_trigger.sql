-- Mueve la asignación de numero a un trigger BEFORE INSERT, para que un insert
-- fallido en solicitudes nunca consuma un número del contador _solicitud_counter.

-- Resetear el contador al número de solicitudes reales existentes, corrigiendo
-- los huecos dejados por los intentos de guardado que fallaron antes del insert.
UPDATE public._solicitud_counter
SET next_number = COALESCE((SELECT COUNT(*) FROM public.solicitudes), 0)
WHERE id = 1;

CREATE OR REPLACE FUNCTION public.set_solicitud_numero()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_num integer;
BEGIN
  IF NEW.numero IS NULL THEN
    UPDATE public._solicitud_counter
    SET next_number = next_number + 1, updated_at = now()
    WHERE id = 1
    RETURNING next_number INTO next_num;
    NEW.numero := 'S-' || LPAD(next_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_solicitud_numero ON public.solicitudes;
CREATE TRIGGER trg_set_solicitud_numero
BEFORE INSERT ON public.solicitudes
FOR EACH ROW
EXECUTE FUNCTION public.set_solicitud_numero();
