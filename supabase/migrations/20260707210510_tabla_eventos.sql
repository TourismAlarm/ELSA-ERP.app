-- Versiona la tabla "eventos", creada a mano en el SQL Editor. Idempotente:
-- no rompe donde la tabla ya existe; sirve para recrearla en producción.
CREATE TABLE IF NOT EXISTS public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio time,
  hora_fin time,
  todo_el_dia boolean DEFAULT false,
  recurso_id uuid,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON public.eventos(fecha);
