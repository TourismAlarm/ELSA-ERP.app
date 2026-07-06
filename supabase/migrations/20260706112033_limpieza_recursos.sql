-- Limpieza tras fusionar recursos en vehiculos. EJECUTAR SOLO cuando la nueva
-- versión de la app ya esté desplegada y verificada (deja de usar recurso_id
-- y la tabla recursos). Los datos ya se migraron en la migración anterior.

ALTER TABLE public.servicios DROP COLUMN IF EXISTS recurso_id;
DROP TABLE IF EXISTS public.recursos;
