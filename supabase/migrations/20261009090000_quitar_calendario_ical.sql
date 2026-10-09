-- Se retira la conexión con Google Calendar por enlaces iCal (direcciones
-- secretas pegadas a mano y el enlace iCal del ERP con token). Con la cuenta
-- de Google conectada (google_conexion), la app encuentra sola los
-- calendarios de la cuenta, lee sus eventos y escribe en ellos, así que ya
-- no hacen falta. Quitarlo también retira el enlace público con token, que
-- era una puerta más a los datos de clientes.
--
-- Idempotente.

DROP FUNCTION IF EXISTS public.calendario_publico(text);
DROP FUNCTION IF EXISTS public.regenerar_token_calendario();

ALTER TABLE public.config DROP COLUMN IF EXISTS ics_token;
ALTER TABLE public.config DROP COLUMN IF EXISTS google_ics_url;
ALTER TABLE public.config DROP COLUMN IF EXISTS google_calendarios;

NOTIFY pgrst, 'reload schema';
