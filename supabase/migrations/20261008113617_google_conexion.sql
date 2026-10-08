-- Conexión con la cuenta de Google para ESCRIBIR en sus calendarios: lo que
-- se guarda en el ERP (servicios) aparece al momento en el calendario de
-- Google de su vehículo.
--
-- La conexión es un «refresh token» de Google: con él se puede escribir en
-- los calendarios de la cuenta sin que nadie vuelva a iniciar sesión. Es un
-- secreto, así que vive en una tabla con RLS activado y SIN políticas: nadie
-- la lee ni la escribe por la API, ni siquiera admin. Solo el servidor de la
-- app (funciones de Vercel con la clave de servicio, que se salta RLS).
--
-- En config solo queda a la vista qué cuenta está conectada, para enseñarlo
-- en Configuración.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.google_conexion (
  id             integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  refresh_token  text NOT NULL,
  cuenta         text,
  conectado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conectado_en   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_conexion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_conexion FROM anon, authenticated;

ALTER TABLE public.config ADD COLUMN IF NOT EXISTS google_cuenta text;

NOTIFY pgrst, 'reload schema';
