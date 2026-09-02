-- Los textos fijos del presupuesto y los dos campos que cambian de un
-- presupuesto a otro. Hasta ahora el PDF de la aplicación no se parecía al que
-- la empresa envía de verdad porque estas frases no estaban en ningún sitio.
--
-- Idempotente: se puede reejecutar sin romper nada.

-- ------------------------------------------------------------------ config
-- Los que salen igual en todos los presupuestos. Vacío = se usa el texto de
-- fábrica que trae la aplicación.

-- Teléfono(s) de contratación, bajo el encabezado
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "contractacion" text;

-- Página web, al lado del email
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "web" text;

-- Forma de pago por defecto
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "formaPago" text;

-- Observaciones por defecto, una por línea. Aquí va la del IVA.
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "observaciones" text;

-- "Agradeceremos nos retorne el presente presupuesto, sellado y firmado..."
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "conformidad" text;

-- Aviso legal del pie (GDPR)
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "legal" text;

-- ------------------------------------------------------------- solicitudes
-- Lo que cambia de un presupuesto a otro. Vacío = se usa lo de Configuración.
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS "formaPago" text;
ALTER TABLE public.solicitudes ADD COLUMN IF NOT EXISTS "observaciones" text;

-- Sin esto PostgREST sigue con el esquema viejo y da "Could not find the
-- 'formaPago' column of 'solicitudes'" al guardar
NOTIFY pgrst, 'reload schema';

-- Comprobación:
--   select table_name, column_name from information_schema.columns
--   where table_schema = 'public' and table_name in ('config','solicitudes')
--   and column_name in ('contractacion','web','formaPago','observaciones','conformidad','legal')
--   order by table_name, column_name;
