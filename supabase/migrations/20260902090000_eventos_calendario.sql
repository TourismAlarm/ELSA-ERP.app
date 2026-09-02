-- Eventos del calendario que no son servicios: visitas, días libres, bajas,
-- un camión en el taller, una revisión... La tabla `eventos` ya existía desde
-- la migración 20260707210510 pero no la usaba nadie, así que se amplía en vez
-- de crear otra.
--
-- Idempotente: se puede reejecutar sin romper nada.

-- Tipo del evento. Decide el icono y el color por defecto en el calendario.
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'otro';

-- Color propio, opcional: si está vacío se usa el del tipo
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS color text;

-- Fecha de fin, para los que duran varios días. Unas vacaciones o una baja no
-- son un día suelto, y repetir el evento día a día sería insufrible.
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS fecha_fin date;

-- Vehículo al que afecta, opcional: un camión en el taller es un evento del
-- calendario, no un mantenimiento cerrado. Si se borra el vehículo el evento
-- se queda, solo pierde el vínculo.
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS vehiculo_id uuid REFERENCES public.vehiculos(id) ON DELETE SET NULL;

-- recurso_id venía de la tabla `recursos`, que se retiró en la migración
-- 20260706120353. Nunca se llegó a usar.
ALTER TABLE public.eventos DROP COLUMN IF EXISTS recurso_id;

-- El calendario pide siempre un rango de fechas
CREATE INDEX IF NOT EXISTS idx_eventos_fecha_fin ON public.eventos(fecha_fin);

-- Comprobación:
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'eventos'
--   order by ordinal_position;
