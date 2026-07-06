-- Fusiona "recursos" dentro de "vehiculos": el vehículo pasa a tener color y
-- es a la vez la ficha física y el recurso de agenda que pinta el calendario.
-- Migración aditiva (sin downtime): la app antigua sigue funcionando con
-- recurso_id/recursos hasta que se despliega la nueva. La limpieza va aparte.

-- 1) El vehículo gana un color
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS color text;

-- 2) Pasar los recursos existentes a la flota conservando su id (así los
--    servicios que ya apuntaban a un recurso siguen enlazando bien)
INSERT INTO public.vehiculos (id, nombre, color, activo)
SELECT id, nombre, color, activo FROM public.recursos
ON CONFLICT (id) DO NOTHING;

-- 3) Nuevo enlace del servicio al vehículo, copiado desde el recurso anterior
ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS vehiculo_id uuid REFERENCES public.vehiculos(id) ON DELETE SET NULL;

UPDATE public.servicios SET vehiculo_id = recurso_id
WHERE recurso_id IS NOT NULL AND vehiculo_id IS NULL;
