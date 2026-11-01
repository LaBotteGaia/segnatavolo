ALTER TABLE public.restaurants ADD COLUMN website_url text NOT NULL DEFAULT '';
UPDATE public.restaurants SET website_url=coalesce(settings->'profile'->>'website','');
CREATE OR REPLACE FUNCTION public.sync_restaurant_website() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF length(NEW.website_url)>500 THEN RAISE EXCEPTION 'Indirizzo sito troppo lungo'; END IF; NEW.settings:=jsonb_set(NEW.settings,'{profile}',coalesce(NEW.settings->'profile','{}')||jsonb_build_object('website',NEW.website_url)); RETURN NEW; END $$;
CREATE TRIGGER zz_restaurant_website_sync BEFORE INSERT OR UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.sync_restaurant_website();
COMMENT ON COLUMN public.restaurants.contact_phone IS 'Dedicated online phone, effective only when booking_phone_override is true';
COMMENT ON COLUMN public.restaurants.contact_whatsapp IS 'Dedicated online WhatsApp, effective only when booking_phone_override is true';