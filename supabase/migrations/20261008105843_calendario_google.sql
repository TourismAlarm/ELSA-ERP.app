-- Conectar el calendario del ERP con Google Calendar, en los dos sentidos,
-- sin iniciar sesión con Google:
--
--   · ERP → Google: la app publica un enlace iCal (/api/calendario?token=…)
--     que se añade en Google Calendar con «Añadir calendario → Desde URL».
--     El enlace lleva un token secreto. Quien lo tenga ve los servicios y
--     eventos (nombres de cliente y direcciones), así que solo lo genera o
--     cambia administración, y cambiarlo invalida el enlace anterior.
--   · Google → ERP: se guarda la «dirección secreta en formato iCal» del
--     calendario de Google y el servidor de la app la descarga para enseñar
--     esos eventos (con todo el historial) en el calendario del ERP, en
--     solo lectura.
--
-- Idempotente.

ALTER TABLE public.config ADD COLUMN IF NOT EXISTS ics_token text;
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS google_ics_url text;

-- El token no se escribe desde el formulario de configuración: solo con
-- esta función, que lo genera en el servidor. 64 caracteres hexadecimales
-- de dos UUID v4 (unos 244 bits aleatorios).
CREATE OR REPLACE FUNCTION public.regenerar_token_calendario()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t text;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo administración puede generar el enlace del calendario.';
  END IF;
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  UPDATE public.config SET ics_token = t, updated_at = now() WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay configuración guardada todavía.';
  END IF;
  RETURN t;
END;
$$;

-- Lo que publica el enlace iCal. La llama el servidor de la app sin sesión
-- (rol anon), así que el único control es el token: sin token configurado,
-- o con uno que no coincide, no devuelve nada. Solo los campos que hacen
-- falta para el calendario, y del último año en adelante, para que el
-- fichero no crezca sin fin.
CREATE OR REPLACE FUNCTION public.calendario_publico(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  valido boolean;
BEGIN
  SELECT c.ics_token IS NOT NULL AND length(c.ics_token) >= 32 AND c.ics_token = p_token
    INTO valido
    FROM public.config c WHERE c.id = 1;
  IF NOT COALESCE(valido, false) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'servicios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'numero', s.numero, 'cliente', s.cliente, 'vehiculo', s.vehiculo,
        'origen', s.origen, 'destino', s.destino, 'descripcion', s.descripcion,
        'fecha', s.fecha_servicio, 'hora_inicio', s.hora_inicio, 'hora_fin', s.hora_fin,
        'estado', s.estado, 'updated_at', s.updated_at))
      FROM public.servicios s
      WHERE s.fecha_servicio >= current_date - 365), '[]'::jsonb),
    'eventos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'titulo', e.titulo, 'tipo', e.tipo, 'notas', e.notas,
        'fecha', e.fecha, 'fecha_fin', e.fecha_fin, 'hora_inicio', e.hora_inicio,
        'hora_fin', e.hora_fin, 'todo_el_dia', e.todo_el_dia, 'updated_at', e.updated_at))
      FROM public.eventos e
      WHERE COALESCE(e.fecha_fin, e.fecha) >= current_date - 365), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.regenerar_token_calendario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerar_token_calendario() TO authenticated;
REVOKE ALL ON FUNCTION public.calendario_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calendario_publico(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
