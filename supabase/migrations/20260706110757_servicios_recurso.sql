-- Cada servicio puede asignarse a un recurso de agenda (24+jib, Externo,
-- Descarga en base, un camión concreto...). El calendario lo pinta con el
-- color de ese recurso. Al borrar un recurso, los servicios quedan sin
-- recurso asignado (no se borran).
--
-- CORRECCIÓN 29/09/2026 (informe de revisión, hallazgo A1): la tabla
-- public.recursos se creó a mano y nunca estuvo en el repositorio, así que al
-- levantar la base desde cero esta migración fallaba y bloqueaba todas las
-- siguientes. La columna y la tabla se retiraron dos migraciones después
-- (20260706120353_retirar_recursos), de modo que ahora solo se añade la
-- columna si la tabla existe. En la base real esta migración ya estaba
-- aplicada, así que el cambio solo afecta a una reconstrucción desde cero.
DO $$
BEGIN
  IF to_regclass('public.recursos') IS NOT NULL THEN
    ALTER TABLE public.servicios
      ADD COLUMN IF NOT EXISTS recurso_id uuid REFERENCES public.recursos(id) ON DELETE SET NULL;
  END IF;
END $$;
