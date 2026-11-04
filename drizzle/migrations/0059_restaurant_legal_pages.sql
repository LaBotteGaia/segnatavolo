ALTER TABLE public.restaurants
 ADD COLUMN IF NOT EXISTS legal_name text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS registered_address text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS privacy_email text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS custom_privacy_url text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.validate_restaurant_legal() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN
 IF length(NEW.legal_name)>200 OR length(NEW.registered_address)>500 OR length(NEW.privacy_email)>255 OR length(NEW.custom_privacy_url)>1000
  OR (NEW.privacy_email<>'' AND NEW.privacy_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  OR (NEW.custom_privacy_url<>'' AND NEW.custom_privacy_url !~ '^https://') THEN RAISE EXCEPTION 'Controlla i dati legali del ristorante'; END IF;
 RETURN NEW; END $$;
DROP TRIGGER IF EXISTS validate_restaurant_legal ON public.restaurants;
CREATE TRIGGER validate_restaurant_legal BEFORE INSERT OR UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.validate_restaurant_legal();

CREATE OR REPLACE FUNCTION public.get_restaurant_legal(_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE r public.restaurants; BEGIN
 IF _slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.restaurants WHERE web_slug=lower(_slug) AND online_enabled; IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('slug',r.web_slug,'name',r.name,'logo',r.public_logo_url,'legal_name',r.legal_name,'vat_number',r.vat_number,
  'registered_address',CASE WHEN r.registered_address<>'' THEN r.registered_address ELSE r.public_address END,
  'privacy_email',CASE WHEN r.privacy_email<>'' THEN r.privacy_email WHEN r.booking_email_override THEN r.booking_email ELSE r.main_email END,
  'custom_privacy_url',r.custom_privacy_url,'no_show_tolerance_minutes',r.no_show_tolerance_minutes,'morning_reminder_enabled',r.morning_reminder_enabled,
  'first_shift_duration_minutes',CASE WHEN r.online_turns_override THEN r.first_shift_duration_minutes ELSE coalesce((r.settings->>'duration')::int,90) END);
END $$;

CREATE OR REPLACE FUNCTION public.list_public_restaurants() RETURNS TABLE(slug text, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT web_slug, name FROM public.restaurants WHERE online_enabled AND web_slug IS NOT NULL ORDER BY name $$;

REVOKE ALL ON FUNCTION public.get_restaurant_legal(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_restaurants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_legal(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_restaurants() TO anon, authenticated;