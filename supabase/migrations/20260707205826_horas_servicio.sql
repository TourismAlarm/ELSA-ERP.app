-- Guarda como migración lo que se ejecutó a mano en el SQL Editor:
-- columnas de hora de inicio y fin de los servicios (usadas por el
-- formulario y el calendario desde el PR #26). Necesario para poder
-- recrear el esquema en la Supabase de producción.
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS hora_inicio time;
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS hora_fin time;

-- NOTA: la tabla "eventos" también se creó a mano y está pendiente de
-- versionar en una migración aparte cuando tengamos su definición exacta
-- (SELECT de pg_get para generarla desde la base de datos actual).
