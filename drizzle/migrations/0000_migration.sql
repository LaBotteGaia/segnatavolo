CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  seats int NOT NULL DEFAULT 4,
  x int NOT NULL DEFAULT 0,
  y int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_name_lower_idx ON public.customers (lower(name));
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('pranzo','sera')),
  time text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  phone text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  people int NOT NULL DEFAULT 2,
  table_ids uuid[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  outside boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  arrived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservations_date_idx ON public.reservations(date, shift);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms, public.restaurant_tables, public.customers, public.reservations TO authenticated;
GRANT ALL ON public.rooms, public.restaurant_tables, public.customers, public.reservations TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff all rooms" ON public.rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff all tables" ON public.restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff all customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff all reservations" ON public.reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;

INSERT INTO public.rooms (id, name, sort_order) VALUES
 ('11111111-1111-1111-1111-111111111111','Sala Interna',0),
 ('22222222-2222-2222-2222-222222222222','Dehors',1);
INSERT INTO public.restaurant_tables (room_id, name, seats, x, y) VALUES
 ('11111111-1111-1111-1111-111111111111','T1',2,0,0),
 ('11111111-1111-1111-1111-111111111111','T2',4,1,0),
 ('11111111-1111-1111-1111-111111111111','T3',4,2,0),
 ('11111111-1111-1111-1111-111111111111','T4',4,0,1),
 ('11111111-1111-1111-1111-111111111111','T5',4,1,1),
 ('11111111-1111-1111-1111-111111111111','T6',6,2,1),
 ('22222222-2222-2222-2222-222222222222','E1',2,0,0),
 ('22222222-2222-2222-2222-222222222222','E2',4,1,0),
 ('22222222-2222-2222-2222-222222222222','E3',4,2,0);