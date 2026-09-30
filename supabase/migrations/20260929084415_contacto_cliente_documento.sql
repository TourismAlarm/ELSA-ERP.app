-- Teléfono y email del cliente en solicitudes y servicios.
--
-- Los formularios de solicitud y servicio tienen campos de teléfono y email,
-- pero no había columnas donde guardarlos: al guardar se tiraban y, al volver
-- a entrar, solo reaparecían si la ficha del cliente los tenía. Si el cliente
-- no estaba dado de alta, no tenía esos datos en su ficha o se escribía un
-- contacto distinto para ese trabajo, lo escrito se perdía.
--
-- En camelCase entrecomillado, como "formaPago", para que coincidan con los
-- nombres que usa la aplicación.
--
-- Idempotente: se puede reejecutar sin romper nada.

ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS "telCliente"   text;
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS "emailCliente" text;
ALTER TABLE public.servicios   ADD COLUMN IF NOT EXISTS "telCliente"   text;
ALTER TABLE public.servicios   ADD COLUMN IF NOT EXISTS "emailCliente" text;

-- Sin esto PostgREST sigue con el esquema viejo y da "Could not find the
-- 'telCliente' column of 'solicitudes'" al guardar
NOTIFY pgrst, 'reload schema';

-- Comprobación:
--   select table_name, column_name from information_schema.columns
--   where table_schema = 'public' and table_name in ('solicitudes','servicios')
--   and column_name in ('telCliente','emailCliente')
--   order by table_name, column_name;
