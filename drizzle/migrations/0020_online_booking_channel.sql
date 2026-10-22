ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS online_enabled boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS web_slug text, ADD COLUMN IF NOT EXISTS online_config jsonb NOT NULL DEFAULT '{"max_days":30,"cutoff":"hours","cutoff_hours":2,"closed_message":"Per prenotazioni dell’ultimo minuto contatta direttamente il ristorante."}'::jsonb, ADD COLUMN IF NOT EXISTS public_address text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS public_logo_url text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_web_slug_unique ON public.restaurants(lower(web_slug)) WHERE web_slug IS NOT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'internal', ADD COLUMN IF NOT EXISTS contact_email text, ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz, ADD COLUMN IF NOT EXISTS privacy_policy_url text, ADD COLUMN IF NOT EXISTS online_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_online_request_unique ON public.reservations(online_request_id) WHERE online_request_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.validate_online_config() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.web_slug IS NOT NULL AND NEW.web_slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' THEN RAISE EXCEPTION 'Identificativo Web non valido'; END IF;
 IF NEW.online_enabled AND NEW.web_slug IS NULL THEN RAISE EXCEPTION 'Inserisci un identificativo Web'; END IF;
 IF coalesce((NEW.online_config->>'max_days')::int,30) NOT BETWEEN 1 AND 365 OR coalesce((NEW.online_config->>'cutoff_hours')::int,2) NOT BETWEEN 0 AND 72 OR coalesce(NEW.online_config->>'cutoff','hours') NOT IN ('hours','previous_day','24h','48h') OR length(coalesce(NEW.online_config->>'closed_message',''))>1000 THEN RAISE EXCEPTION 'Regole online non valide'; END IF;
 IF length(NEW.public_address)>300 OR length(NEW.public_logo_url)>1000 OR (NEW.public_logo_url<>'' AND NEW.public_logo_url !~ '^https://') THEN RAISE EXCEPTION 'Indirizzo o logo non validi'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER validate_restaurant_online_config BEFORE INSERT OR UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.validate_online_config();
CREATE OR REPLACE FUNCTION public.online_shift_remaining(_rid uuid,_date date,_shift text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE st jsonb; cfg jsonb; sh jsonb; r record; cap integer:=0; booked integer; doubled boolean; md text:=to_char(_date,'MM-DD'); dow integer:=extract(dow from _date); start_at timestamptz; deadline timestamptz; today date:=(now() AT TIME ZONE 'Europe/Rome')::date;
BEGIN
 SELECT settings,online_config INTO st,cfg FROM public.restaurants WHERE id=_rid AND online_enabled;
 IF NOT FOUND OR _shift NOT IN ('pranzo','sera') THEN RETURN NULL; END IF;
 IF _date<today OR _date>today+coalesce((cfg->>'max_days')::int,30) THEN RETURN NULL; END IF;
 sh:=st->'shifts'->_shift;
 IF NOT coalesce((sh->>'enabled')::boolean,true) OR coalesce(st->'weekly'->dow::text,'[]'::jsonb) ? _shift OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(st->'holidays','[]')) h WHERE _date::text BETWEEN h->>'from' AND h->>'to') THEN RETURN NULL; END IF;
 start_at:=(_date::text||' '||coalesce(sh->>'from',CASE WHEN _shift='pranzo' THEN '12:00' ELSE '19:00' END))::timestamp AT TIME ZONE 'Europe/Rome';
 deadline:=CASE coalesce(cfg->>'cutoff','hours') WHEN 'previous_day' THEN _date::timestamp AT TIME ZONE 'Europe/Rome' WHEN '24h' THEN start_at-interval '24 hours' WHEN '48h' THEN start_at-interval '48 hours' ELSE start_at-make_interval(hours=>coalesce((cfg->>'cutoff_hours')::int,2)) END;
 IF now()>=deadline THEN RETURN NULL; END IF;
 FOR r IN SELECT * FROM public.rooms WHERE restaurant_id=_rid LOOP
  IF NOT dow=ANY(r.open_days) OR _shift=ANY(r.closed_shifts) OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.closed_periods) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN md BETWEEN p->>'from' AND p->>'to' ELSE md>=p->>'from' OR md<=p->>'to' END) THEN CONTINUE; END IF;
  SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(r.double_shifts) d WHERE d->'shifts' ? _shift AND (jsonb_array_length(d->'days')=0 OR d->'days' @> to_jsonb(ARRAY[dow])) AND (coalesce(d->>'from','')='' OR coalesce(d->>'to','')='' OR CASE WHEN d->>'from'<=d->>'to' THEN md BETWEEN d->>'from' AND d->>'to' ELSE md>=d->>'from' OR md<=d->>'to' END)) INTO doubled;
  cap:=cap+coalesce((SELECT sum(seats) FROM public.restaurant_tables WHERE restaurant_id=_rid AND room_id=r.id),0)*(CASE WHEN doubled THEN 2 ELSE 1 END);
 END LOOP;
 IF cap=0 THEN RETURN NULL; END IF;
 SELECT coalesce(sum(people),0) INTO booked FROM public.reservations WHERE restaurant_id=_rid AND date=_date AND shift=_shift AND deleted_at IS NULL AND NOT(no_show AND NOT arrived);
 RETURN greatest(0,cap-coalesce((st->>'reserve')::int,4)-booked);
END $$;
REVOKE ALL ON FUNCTION public.online_shift_remaining(uuid,date,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_online_booking_page(_slug text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.restaurants; days jsonb; today date:=(now() AT TIME ZONE 'Europe/Rome')::date;
BEGIN
 IF _slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.restaurants WHERE web_slug=lower(_slug) AND online_enabled;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT jsonb_agg(jsonb_build_object('date',d::date::text,'pranzo',public.online_shift_remaining(r.id,d::date,'pranzo'),'sera',public.online_shift_remaining(r.id,d::date,'sera')) ORDER BY d) INTO days FROM generate_series(today::timestamp,(today+coalesce((r.online_config->>'max_days')::int,30))::timestamp,interval '1 day') d;
 RETURN jsonb_build_object('name',r.name,'address',r.public_address,'logo',r.public_logo_url,'config',r.online_config,'shifts',jsonb_build_object('pranzo',coalesce(r.settings->'shifts'->'pranzo','{"enabled":true,"from":"12:00","to":"14:30"}'::jsonb),'sera',coalesce(r.settings->'shifts'->'sera','{"enabled":true,"from":"19:00","to":"23:00"}'::jsonb)),'today',today::text,'days',days);
END $$;
REVOKE ALL ON FUNCTION public.get_online_booking_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_booking_page(text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.submit_online_booking(_slug text,_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; cid uuid; res uuid; pax integer; dt date; sh text; tm text; ph text; nm text; em text; remaining integer; settings jsonb; cfg jsonb; request_id uuid;
BEGIN
 SELECT id,restaurants.settings,online_config INTO rid,settings,cfg FROM public.restaurants WHERE web_slug=_slug AND online_enabled;
 IF rid IS NULL THEN RAISE EXCEPTION 'Canale online non disponibile'; END IF;
 pax:=(_data->>'people')::int; dt:=(_data->>'date')::date; sh:=_data->>'shift'; tm:=_data->>'time'; nm:=trim(_data->>'name'); ph:=regexp_replace(_data->>'phone','[\s\-./()]','','g'); em:=lower(trim(_data->>'email')); request_id:=(_data->>'request_id')::uuid;
 IF pax IS NULL OR pax NOT BETWEEN 1 AND 100 OR dt IS NULL OR sh IS NULL OR sh NOT IN ('pranzo','sera') OR tm IS NULL OR tm !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR nm IS NULL OR length(nm) NOT BETWEEN 2 AND 150 OR ph IS NULL OR ph !~ '^\+?[0-9]{7,15}$' OR em IS NULL OR length(em)>255 OR em !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' OR length(coalesce(_data->>'notes',''))>1000 OR coalesce((_data->>'privacy')::boolean,false) IS NOT TRUE OR request_id IS NULL THEN RAISE EXCEPTION 'Controlla i dati e accetta Termini e Privacy'; END IF;
 IF tm<coalesce(settings->'shifts'->sh->>'from',CASE WHEN sh='pranzo' THEN '12:00' ELSE '19:00' END) OR tm>coalesce(settings->'shifts'->sh->>'to',CASE WHEN sh='pranzo' THEN '14:30' ELSE '23:00' END) OR extract(minute FROM tm::time)::int%15<>0 THEN RAISE EXCEPTION 'Orario non valido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,0));
 SELECT id INTO res FROM public.reservations WHERE restaurant_id=rid AND online_request_id=request_id;
 IF res IS NOT NULL THEN RETURN jsonb_build_object('id',res); END IF;
 remaining:=public.online_shift_remaining(rid,dt,sh);
 IF remaining IS NULL THEN RAISE EXCEPTION '%',coalesce(cfg->>'closed_message','Prenotazioni chiuse per questa data'); END IF;
 IF remaining<pax THEN RAISE EXCEPTION 'Turno non disponibile per il numero di persone selezionato'; END IF;
 SELECT id INTO cid FROM public.customers WHERE restaurant_id=rid AND regexp_replace(phone,'[\s\-./()]','','g')=ph ORDER BY created_at LIMIT 1;
 IF cid IS NULL THEN
 INSERT INTO public.customers(restaurant_id,name,phone,emails,marketing_consent,marketing_consent_at) VALUES(rid,nm,ph,ARRAY[em],coalesce((_data->>'marketing')::boolean,false),CASE WHEN coalesce((_data->>'marketing')::boolean,false) THEN now() ELSE NULL END) RETURNING id INTO cid;
 ELSIF coalesce((_data->>'marketing')::boolean,false) THEN
 UPDATE public.customers SET marketing_consent=true,marketing_consent_at=now(),emails=CASE WHEN em=ANY(emails) THEN emails ELSE array_append(emails,em) END WHERE restaurant_id=rid AND id=cid;
 END IF;
 INSERT INTO public.reservations(restaurant_id,date,shift,time,name,phone,customer_id,people,notes,outside,is_new,channel,contact_email,privacy_consent_at,privacy_policy_url,online_request_id) VALUES(rid,dt,sh,tm,nm,ph,cid,pax,coalesce(_data->>'notes','')||CASE WHEN coalesce((_data->>'outside')::boolean,false) THEN E'\nPreferenza esterno (senza garanzia)' ELSE E'\nPreferenza interno (senza garanzia)' END,coalesce((_data->>'outside')::boolean,false),false,'online',em,now(),'https://www.labottegaia.it/termini-e-condizioni-segnatavolo/',request_id) RETURNING id INTO res;
 RETURN jsonb_build_object('id',res);
END $$;
REVOKE ALL ON FUNCTION public.submit_online_booking(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_online_booking(text,jsonb) TO anon,authenticated,service_role;