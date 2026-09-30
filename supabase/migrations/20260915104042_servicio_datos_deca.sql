-- Datos del DeCA en el servicio.
--
-- A partir del 5 de octubre de 2026 hay que emitir un DeCA (documento
-- electrónico de control administrativo) ANTES de iniciar cada transporte
-- público de mercancías. Cuelga del servicio y no del albarán: el albarán
-- nace cuando el trabajo ya está hecho, y el DeCA tiene que existir antes de
-- salir.
--
-- Esta migración solo guarda los datos que ese documento exige y que la tabla
-- servicios no tenía: naturaleza y peso de la mercancía, bultos, autorización
-- especial de circulación y las matrículas de tractora y remolque. El
-- interruptor requiere_deca marca qué servicios lo necesitan, que no todos
-- los trabajos de grúa son transporte público de mercancías.
--
-- El DeCA en sí (PDF y QR) viene en fases posteriores.
--
-- Idempotente: se puede reejecutar sin romper nada.

ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS requiere_deca boolean DEFAULT false;
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS naturaleza_mercancia text;
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS peso numeric;
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS bultos integer;
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS autorizacion_especial text;
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS matricula_tractora text;
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS matricula_remolque text;

-- Sin esto PostgREST sigue con el esquema viejo y guardar el servicio falla
-- con "Could not find the 'requiere_deca' column of 'servicios'"
NOTIFY pgrst, 'reload schema';

-- Comprobación: deben salir las siete columnas
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'servicios'
--   and column_name in ('requiere_deca', 'naturaleza_mercancia', 'peso', 'bultos',
--                       'autorizacion_especial', 'matricula_tractora', 'matricula_remolque');
