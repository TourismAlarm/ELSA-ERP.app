-- Cada servicio puede asignarse a un recurso de agenda (24+jib, Externo,
-- Descarga en base, un camión concreto...). El calendario lo pinta con el
-- color de ese recurso. Al borrar un recurso, los servicios quedan sin
-- recurso asignado (no se borran).
ALTER TABLE public.servicios
  ADD COLUMN IF NOT EXISTS recurso_id uuid REFERENCES public.recursos(id) ON DELETE SET NULL;
