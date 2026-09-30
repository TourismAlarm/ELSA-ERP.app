-- Caja de notas internas de maniobra en solicitudes y servicios.
--
-- Es lo que el equipo necesita para hacer el trabajo (por dónde entrar, con
-- quién hablar, qué avisar) y que el cliente no debe leer. Va en columna
-- aparte de "descripcion" a propósito: la descripción se imprime en el
-- presupuesto, en la hoja del servicio y en el albarán, y esto no se imprime
-- en ningún documento ni mensaje que salga de la empresa.
--
-- Idempotente: se puede reejecutar sin romper nada.

ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS notas_internas text;
ALTER TABLE public.servicios   ADD COLUMN IF NOT EXISTS notas_internas text;

-- Sin esto PostgREST sigue con el esquema viejo y da "Could not find the
-- 'notas_internas' column of 'solicitudes'" al guardar
NOTIFY pgrst, 'reload schema';

-- Comprobación:
--   select table_name, column_name from information_schema.columns
--   where table_schema = 'public' and table_name in ('solicitudes','servicios')
--   and column_name = 'notas_internas'
--   order by table_name;
