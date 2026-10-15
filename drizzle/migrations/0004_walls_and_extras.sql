ALTER TABLE public.rooms ADD COLUMN walls jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.reservations ADD COLUMN extra_sponde integer NOT NULL DEFAULT 0;
ALTER TABLE public.reservations ADD COLUMN extra_barelle integer NOT NULL DEFAULT 0;
ALTER TABLE public.reservations ADD COLUMN barella_seats integer NOT NULL DEFAULT 2;