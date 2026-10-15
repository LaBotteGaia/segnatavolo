ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT true;
CREATE TABLE public.service_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL DEFAULT public.my_restaurant_id() REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date date NOT NULL,
  shift text NOT NULL,
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, date, shift)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_notes TO authenticated;
GRANT ALL ON public.service_notes TO service_role;
ALTER TABLE public.service_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members all service_notes" ON public.service_notes FOR ALL TO authenticated
  USING (restaurant_id = public.my_restaurant_id()) WITH CHECK (restaurant_id = public.my_restaurant_id());
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_notes;