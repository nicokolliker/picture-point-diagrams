
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0EA5E9',
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas_select_all" ON public.areas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "areas_admin_write" ON public.areas
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER areas_set_updated_at
  BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.areas (name, color, sort_order) VALUES
  ('Operaciones', '#0EA5E9', 1),
  ('Ventas',      '#F472B6', 2),
  ('Producto',    '#A78BFA', 3),
  ('Finanzas',    '#22D3EE', 4),
  ('RRHH',        '#34D399', 5);
