CREATE TABLE public.restaurant_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL DEFAULT public.my_restaurant_id() REFERENCES public.restaurants(id) ON DELETE CASCADE,
  raw_text text NOT NULL CHECK (char_length(raw_text) BETWEEN 3 AND 1500),
  parsed_logic jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_assignment_rules_restaurant_idx ON public.restaurant_assignment_rules(restaurant_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_assignment_rules TO authenticated;
GRANT ALL ON public.restaurant_assignment_rules TO service_role;
ALTER TABLE public.restaurant_assignment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read assignment rules" ON public.restaurant_assignment_rules FOR SELECT TO authenticated USING (restaurant_id = public.my_restaurant_id());
CREATE POLICY "master write assignment rules" ON public.restaurant_assignment_rules FOR ALL TO authenticated USING (restaurant_id = public.my_restaurant_id() AND public.is_master()) WITH CHECK (restaurant_id = public.my_restaurant_id() AND public.is_master());
CREATE POLICY "super admin all assignment rules" ON public.restaurant_assignment_rules FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_assignment_rules;