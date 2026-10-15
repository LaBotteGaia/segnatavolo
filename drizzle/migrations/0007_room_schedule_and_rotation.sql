ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS open_days integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS closed_periods jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS duration_min integer;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS buffer_min integer;