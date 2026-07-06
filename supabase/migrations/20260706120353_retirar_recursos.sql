-- Los "recursos" se fusionan en la lista de vehículos/equipos (config.vehicles,
-- ahora con color). Ya no se usan ni la columna servicios.recurso_id ni la
-- tabla recursos. La app deja de referenciarlas antes de esta limpieza.
ALTER TABLE public.servicios DROP COLUMN IF EXISTS recurso_id;
DROP TABLE IF EXISTS public.recursos;
