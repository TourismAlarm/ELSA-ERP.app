-- Número de cliente. Hace falta para que los albaranes que se pasan a Factusol
-- lleven el código con el que ese cliente está dado de alta allí.
--
-- Se guarda como texto y no como número porque los códigos de Factusol pueden
-- llevar ceros a la izquierda ("0042") o no ser numéricos del todo.
--
-- Idempotente: se puede reejecutar sin romper nada.

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numero text;

-- Contador propio, con la misma semántica que los de solicitudes, servicios y
-- albaranes: next_number guarda el PRÓXIMO número a asignar y solo sube. Que
-- un cliente borrado libere su número sería un problema: ese código ya existe
-- en Factusol apuntando a otra empresa.
INSERT INTO public.contadores (clave, next_number)
VALUES ('cliente', 1)
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.asignar_numero_cliente()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  n integer;
BEGIN
  IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
    -- Sin número: se coge el siguiente del contador
    UPDATE public.contadores
    SET next_number = next_number + 1, updated_at = now()
    WHERE clave = 'cliente'
    RETURNING next_number - 1 INTO n;
    NEW.numero := n::text;
  ELSE
    -- Número puesto a mano o traído del Excel: se respeta tal cual, y si es
    -- numérico se empuja el contador por encima para que los siguientes altas
    -- automáticas continúen la numeración en vez de chocar con lo importado.
    NEW.numero := btrim(NEW.numero);
    IF NEW.numero ~ '^[0-9]+$' THEN
      UPDATE public.contadores
      SET next_number = NEW.numero::integer + 1, updated_at = now()
      WHERE clave = 'cliente' AND next_number <= NEW.numero::integer;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_cliente ON public.clientes;
CREATE TRIGGER trg_asignar_numero_cliente
BEFORE INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.asignar_numero_cliente();

-- Poner número a los clientes que ya existan sin él, por orden de alta
WITH numerados AS (
  SELECT id, row_number() OVER (ORDER BY nombre) AS n
  FROM public.clientes
  WHERE numero IS NULL OR btrim(numero) = ''
)
UPDATE public.clientes c
SET numero = numerados.n::text
FROM numerados
WHERE c.id = numerados.id;

-- Y dejar el contador por encima del mayor número numérico que haya
UPDATE public.contadores
SET next_number = GREATEST(
      next_number,
      COALESCE((SELECT MAX(CASE WHEN numero ~ '^[0-9]+$' THEN numero::integer END)
                FROM public.clientes), 0) + 1
    ),
    updated_at = now()
WHERE clave = 'cliente';

-- Buscar por número tiene que ser rápido cuando haya cientos de clientes
CREATE INDEX IF NOT EXISTS idx_clientes_numero ON public.clientes(numero);

-- Comprobación:
--   select numero, nombre from public.clientes order by numero::integer;
--   select * from public.contadores where clave = 'cliente';
