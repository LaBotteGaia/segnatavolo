ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '';
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS updated_by_name text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.reservations r SET created_by_name = m.name FROM public.restaurant_members m WHERE r.created_by = m.user_id AND r.restaurant_id = m.restaurant_id AND r.created_by_name = '';
CREATE OR REPLACE FUNCTION public.set_operator_name(_name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR length(trim(_name)) = 0 OR length(trim(_name)) > 80 THEN RAISE EXCEPTION 'Inserisci un nome o nickname di sala valido'; END IF;
 UPDATE public.restaurant_members SET name = trim(_name) WHERE user_id = auth.uid() AND status = 'active';
 IF NOT FOUND THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_operator_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_operator_name(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.audit_reservation_operator() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE operator_name text;
BEGIN
 IF auth.uid() IS NOT NULL THEN
  SELECT name INTO operator_name FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id = NEW.restaurant_id AND status = 'active';
  IF operator_name IS NULL OR length(trim(operator_name)) = 0 THEN RAISE EXCEPTION 'Inserisci il tuo nome o nickname di sala prima di salvare'; END IF;
 ELSE operator_name := 'Sistema'; END IF;
 IF TG_OP = 'INSERT' THEN
  NEW.created_by := auth.uid(); NEW.created_by_name := trim(operator_name); NEW.created_at := now(); NEW.updated_by_name := NULL; NEW.updated_at := NULL;
 ELSE
  NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name; NEW.created_at := OLD.created_at;
  NEW.updated_by_name := trim(operator_name); NEW.updated_at := now();
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER reservation_operator_audit BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.audit_reservation_operator();
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reservations') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customers') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.customers; END IF;
END; $$;