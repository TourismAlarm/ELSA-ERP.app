-- Varios calendarios de Google. En Google hay un calendario por vehículo
-- (14, 19, 23, 24, 24+JIB...) además del general, y cada uno tiene su
-- propia dirección secreta iCal: con una sola dirección solo se veía uno.
--
-- google_calendarios: lista de { nombre, url }. El nombre se cruza con los
-- vehículos de la configuración: si coincide, sus eventos salen con el color
-- de ese vehículo y cuentan como camión ocupado ese día.
--
-- La dirección que hubiera en google_ics_url pasa a la lista. La columna se
-- deja (el servidor la sigue leyendo si la lista está vacía) para no romper
-- nada si se vuelve a una versión anterior de la app.
--
-- Idempotente.

ALTER TABLE public.config ADD COLUMN IF NOT EXISTS google_calendarios jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.config
SET google_calendarios = jsonb_build_array(jsonb_build_object('nombre', 'Google', 'url', google_ics_url))
WHERE COALESCE(google_ics_url, '') <> ''
  AND jsonb_array_length(google_calendarios) = 0;

NOTIFY pgrst, 'reload schema';
