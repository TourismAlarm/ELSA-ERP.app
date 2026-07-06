-- Ampliación del módulo Flota: documentación/fotos, vencimientos extra
-- y historial de mantenimientos y reparaciones por vehículo.

-- Documentación y fotos (mismo formato jsonb que solicitudes/servicios/albaranes)
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS fotos jsonb DEFAULT '[]'::jsonb;

-- Vencimientos extra además de ITV y seguro: [{nombre, fecha}, ...]
ALTER TABLE public.vehiculos ADD COLUMN IF NOT EXISTS vencimientos jsonb DEFAULT '[]'::jsonb;

-- Historial de mantenimientos y reparaciones
CREATE TABLE IF NOT EXISTS public.mantenimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id uuid NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
  fecha date,
  descripcion text,
  taller text,
  coste numeric,
  km numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.mantenimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mantenimientos_autenticados ON public.mantenimientos;
CREATE POLICY mantenimientos_autenticados ON public.mantenimientos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
