ALTER TABLE public.restaurant_tables ADD COLUMN coperti_comodi integer NOT NULL DEFAULT 2;
ALTER TABLE public.restaurant_tables ADD COLUMN coperti_max integer NOT NULL DEFAULT 2;
ALTER TABLE public.restaurant_tables ADD COLUMN posti_scomodi_solo_in_unione boolean NOT NULL DEFAULT true;
ALTER TABLE public.restaurant_tables ADD COLUMN ordine_riempimento integer NOT NULL DEFAULT 99;
UPDATE public.restaurant_tables SET coperti_comodi = seats, coperti_max = seats;
COMMENT ON COLUMN public.restaurant_tables.seats IS 'DEPRECATED: replaced by coperti_comodi/coperti_max; the app keeps it in sync with coperti_comodi';
ALTER TABLE public.reservations ADD COLUMN tavolo_bloccato boolean NOT NULL DEFAULT false;