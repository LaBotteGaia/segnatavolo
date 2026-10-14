CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.restaurant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('master','staff')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.restaurant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('master','staff')),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants, public.restaurant_members, public.restaurant_invites TO authenticated;
GRANT ALL ON public.restaurants, public.restaurant_members, public.restaurant_invites TO service_role;

CREATE OR REPLACE FUNCTION public.my_restaurant_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid() AND status = 'active' LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.is_master() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND status = 'active' AND role = 'master')
$$;

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read restaurant" ON public.restaurants FOR SELECT TO authenticated USING (id = public.my_restaurant_id());
CREATE POLICY "master rename restaurant" ON public.restaurants FOR UPDATE TO authenticated USING (id = public.my_restaurant_id() AND public.is_master());
CREATE POLICY "read own membership" ON public.restaurant_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR restaurant_id = public.my_restaurant_id());
CREATE POLICY "master update members" ON public.restaurant_members FOR UPDATE TO authenticated USING (restaurant_id = public.my_restaurant_id() AND public.is_master() AND user_id <> auth.uid()) WITH CHECK (restaurant_id = public.my_restaurant_id());
CREATE POLICY "master delete members" ON public.restaurant_members FOR DELETE TO authenticated USING (restaurant_id = public.my_restaurant_id() AND public.is_master() AND user_id <> auth.uid());
CREATE POLICY "master manage invites" ON public.restaurant_invites FOR ALL TO authenticated USING (restaurant_id = public.my_restaurant_id() AND public.is_master()) WITH CHECK (restaurant_id = public.my_restaurant_id() AND public.is_master());

-- scope existing data per restaurant
ALTER TABLE public.rooms ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE DEFAULT public.my_restaurant_id();
ALTER TABLE public.restaurant_tables ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE DEFAULT public.my_restaurant_id();
ALTER TABLE public.customers ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE DEFAULT public.my_restaurant_id();
ALTER TABLE public.reservations ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE DEFAULT public.my_restaurant_id();

DROP POLICY "staff all rooms" ON public.rooms;
DROP POLICY "staff all tables" ON public.restaurant_tables;
DROP POLICY "staff all customers" ON public.customers;
DROP POLICY "staff all reservations" ON public.reservations;
CREATE POLICY "members read rooms" ON public.rooms FOR SELECT TO authenticated USING (restaurant_id = public.my_restaurant_id());
CREATE POLICY "master write rooms" ON public.rooms FOR ALL TO authenticated USING (restaurant_id = public.my_restaurant_id() AND public.is_master()) WITH CHECK (restaurant_id = public.my_restaurant_id() AND public.is_master());
CREATE POLICY "members read tables" ON public.restaurant_tables FOR SELECT TO authenticated USING (restaurant_id = public.my_restaurant_id());
CREATE POLICY "master write tables" ON public.restaurant_tables FOR ALL TO authenticated USING (restaurant_id = public.my_restaurant_id() AND public.is_master()) WITH CHECK (restaurant_id = public.my_restaurant_id() AND public.is_master());
CREATE POLICY "members all customers" ON public.customers FOR ALL TO authenticated USING (restaurant_id = public.my_restaurant_id()) WITH CHECK (restaurant_id = public.my_restaurant_id());
CREATE POLICY "members all reservations" ON public.reservations FOR ALL TO authenticated USING (restaurant_id = public.my_restaurant_id()) WITH CHECK (restaurant_id = public.my_restaurant_id());

-- first user creates a restaurant and becomes master; claims pre-existing unassigned data
CREATE OR REPLACE FUNCTION public.create_restaurant(_name text, _display_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; em text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM restaurant_members WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'already member'; END IF;
  SELECT email INTO em FROM auth.users WHERE id = auth.uid();
  INSERT INTO restaurants(name) VALUES (trim(_name)) RETURNING id INTO rid;
  INSERT INTO restaurant_members(restaurant_id,user_id,name,email,role) VALUES (rid, auth.uid(), trim(_display_name), coalesce(em,''), 'master');
  IF (SELECT count(*) FROM restaurants) = 1 THEN
    UPDATE rooms SET restaurant_id = rid WHERE restaurant_id IS NULL;
    UPDATE restaurant_tables SET restaurant_id = rid WHERE restaurant_id IS NULL;
    UPDATE customers SET restaurant_id = rid WHERE restaurant_id IS NULL;
    UPDATE reservations SET restaurant_id = rid WHERE restaurant_id IS NULL;
  END IF;
  RETURN rid;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_restaurant(text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_restaurant(text,text) TO authenticated;

-- public lookup of an invite by its secret token
CREATE OR REPLACE FUNCTION public.get_invite(_token text) RETURNS TABLE(name text, email text, role text, restaurant_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.name, i.email, i.role, r.name FROM restaurant_invites i JOIN restaurants r ON r.id = i.restaurant_id WHERE i.token = _token AND i.accepted_at IS NULL
$$;
GRANT EXECUTE ON FUNCTION public.get_invite(text) TO anon, authenticated;