-- Datos fiscales y de transporte de la empresa.
--
-- A partir del 5 de octubre de 2026 hay que emitir el DeCA (documento
-- electrónico de control administrativo) en los transportes públicos de
-- mercancías, y ese documento identifica al transportista efectivo por su NIF
-- y su autorización de transporte. La tabla config solo guardaba nombre,
-- teléfono, email y dirección (lo que sale en la cabecera de los PDF): no
-- había ningún dato fiscal ni de autorización en ninguna parte.
--
-- Esta migración solo añade las dos columnas; el DeCA en sí viene después.
-- El NIF se imprime también debajo del nombre de la empresa en el presupuesto.
--
-- Idempotente: se puede reejecutar sin romper nada.

ALTER TABLE public.config ADD COLUMN IF NOT EXISTS nif text;
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS autorizacion_transporte text;

-- Sin esto PostgREST sigue con el esquema viejo y guardar la configuración
-- falla con "Could not find the 'nif' column of 'config'"
NOTIFY pgrst, 'reload schema';

-- Comprobación: deben salir las dos columnas
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'config'
--   and column_name in ('nif', 'autorizacion_transporte');
