ALTER TABLE public.restaurants ADD COLUMN timezone varchar NOT NULL DEFAULT 'Europe/Rome', ADD COLUMN custom_intro_text text NOT NULL DEFAULT '', ADD COLUMN booking_window_days integer NOT NULL DEFAULT 30, ADD COLUMN allow_same_day_online boolean NOT NULL DEFAULT false, ADD COLUMN contact_phone varchar NOT NULL DEFAULT '', ADD COLUMN contact_whatsapp varchar NOT NULL DEFAULT '', ADD COLUMN enable_double_shift boolean NOT NULL DEFAULT false, ADD COLUMN double_shift_days text[] NOT NULL DEFAULT '{}', ADD COLUMN first_shift_duration_minutes integer NOT NULL DEFAULT 90, ADD COLUMN no_show_tolerance_minutes integer NOT NULL DEFAULT 15, ADD COLUMN morning_reminder_enabled boolean NOT NULL DEFAULT true;
UPDATE public.restaurants SET booking_window_days=coalesce((online_config->>'max_days')::int,30), first_shift_duration_minutes=greatest(15,coalesce((settings->>'duration')::int,90));
ALTER TABLE public.reservations ADD COLUMN confirmation_status text NOT NULL DEFAULT 'in_attesa_riconferma', ADD COLUMN management_token uuid NOT NULL DEFAULT gen_random_uuid(), ADD COLUMN customer_notes text NOT NULL DEFAULT '', ADD COLUMN morning_reminder_sent_at timestamptz, ADD COLUMN morning_reminder_attempted_at timestamptz, ADD COLUMN morning_reminder_error text;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_reconfirmation_status CHECK (confirmation_status IN ('in_attesa_riconferma','riconfermata','cancellata_cliente','cancellata_no_show'));
CREATE UNIQUE INDEX reservations_management_token_unique ON public.reservations(management_token);
CREATE INDEX reservations_morning_reconfirmation ON public.reservations(date,restaurant_id) WHERE channel='online' AND status='confirmed' AND deleted_at IS NULL;
CREATE OR REPLACE FUNCTION public.validate_booking_policy() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) OR NEW.booking_window_days NOT BETWEEN 1 AND 365 OR NEW.first_shift_duration_minutes NOT BETWEEN 15 AND 480 OR NEW.no_show_tolerance_minutes NOT BETWEEN 0 AND 120 OR length(NEW.custom_intro_text)>5000 OR length(NEW.contact_phone)>40 OR length(NEW.contact_whatsapp)>40 OR NOT NEW.double_shift_days <@ ARRAY['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']::text[] THEN RAISE EXCEPTION 'Controlla le impostazioni delle prenotazioni online'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.booking_window_days IS DISTINCT FROM OLD.booking_window_days THEN NEW.online_config:=jsonb_set(NEW.online_config,'{max_days}',to_jsonb(NEW.booking_window_days));
  ELSIF NEW.online_config->>'max_days' IS DISTINCT FROM OLD.online_config->>'max_days' THEN NEW.booking_window_days:=coalesce((NEW.online_config->>'max_days')::int,30); END IF;
 END IF;
 RETURN NEW; END $$;
CREATE TRIGGER booking_policy_validation BEFORE INSERT OR UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.validate_booking_policy();
CREATE OR REPLACE FUNCTION public.online_booking_date_allowed(_rid uuid,_date date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT _date >= (now() AT TIME ZONE timezone)::date + CASE WHEN allow_same_day_online THEN 0 ELSE 1 END AND _date <= (now() AT TIME ZONE timezone)::date + booking_window_days FROM public.restaurants WHERE id=_rid AND online_enabled),false) $$;
REVOKE ALL ON FUNCTION public.online_booking_date_allowed(uuid,date) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.online_booking_date_allowed(uuid,date) TO service_role;
CREATE OR REPLACE FUNCTION public.restaurant_web_double_day(_rid uuid,_date date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT enable_double_shift AND (ARRAY['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'])[extract(dow FROM _date)::int+1]=ANY(double_shift_days) FROM public.restaurants WHERE id=_rid),false) $$;
REVOKE ALL ON FUNCTION public.restaurant_web_double_day(uuid,date) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.restaurant_web_double_day(uuid,date) TO service_role;
DO $$ DECLARE def text; fn text; BEGIN
 FOREACH fn IN ARRAY ARRAY['public.online_shift_remaining(uuid,date,text)','public.online_slot_remaining(uuid,date,text,text,uuid)'] LOOP
  SELECT pg_get_functiondef(fn::regprocedure) INTO def;
  def:=replace(def,'sh:=st->''shifts''->_shift;','IF NOT public.online_booking_date_allowed(_rid,_date) THEN RETURN NULL; END IF; sh:=st->''shifts''->_shift;');
  def:=replace(def,'today date:=(now() AT TIME ZONE ''Europe/Rome'')::date','tz text; today date');
  def:=replace(def,'SELECT settings,online_config INTO st,cfg','SELECT settings,online_config,timezone,(now() AT TIME ZONE timezone)::date INTO st,cfg,tz,today');
  def:=replace(def,'AT TIME ZONE ''Europe/Rome''','AT TIME ZONE tz');
  def:=replace(def,'physical:=physical+','doubled:=doubled OR public.restaurant_web_double_day(_rid,_date); physical:=physical+');
  def:=replace(def,'cap:=cap+','doubled:=doubled OR public.restaurant_web_double_day(_rid,_date); cap:=cap+');
  def:=replace(def,'dur:=coalesce((st->>''duration'')::int,90);','dur:=CASE WHEN public.restaurant_web_double_day(_rid,_date) AND public.online_slot_turn(_rid,_date,_shift,_time)=1 THEN (SELECT first_shift_duration_minutes FROM public.restaurants WHERE id=_rid) ELSE coalesce((st->>''duration'')::int,90) END;');
  EXECUTE def;
 END LOOP;
 SELECT pg_get_functiondef('public.online_slot_turn(uuid,date,text,text)'::regprocedure) INTO def;
 def:=replace(def,'IF NOT doubled THEN RETURN 0; END IF;','doubled:=doubled OR public.restaurant_web_double_day(_rid,_date); IF NOT doubled THEN RETURN 0; END IF;');
 def:=replace(def,'dur:=coalesce((st->>''duration'')::int,90);','dur:=CASE WHEN public.restaurant_web_double_day(_rid,_date) THEN (SELECT first_shift_duration_minutes FROM public.restaurants WHERE id=_rid) ELSE coalesce((st->>''duration'')::int,90) END;');
 EXECUTE def;
 SELECT pg_get_functiondef('public.submit_online_booking(text,jsonb)'::regprocedure) INTO def;
 def:=replace(def,'UPDATE public.reservations SET status=''pending''','UPDATE public.reservations SET customer_notes=coalesce(_data->>''notes'',''''), duration_min=CASE WHEN public.restaurant_web_double_day(rid,(_data->>''date'')::date) AND public.online_slot_turn(rid,(_data->>''date'')::date,_data->>''shift'',_data->>''time'')=1 THEN (SELECT first_shift_duration_minutes FROM public.restaurants WHERE id=rid) ELSE duration_min END, status=''pending''');
 EXECUTE def;
END $$;
CREATE OR REPLACE FUNCTION public.get_online_booking_page(_slug text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.restaurants; days jsonb; today date; BEGIN
 IF _slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.restaurants WHERE web_slug=lower(_slug) AND online_enabled; IF NOT FOUND THEN RETURN NULL; END IF;
 today:=(now() AT TIME ZONE r.timezone)::date;
 SELECT coalesce(jsonb_agg(jsonb_build_object('date',d::date::text,'pranzo',(SELECT max((s->>'remaining')::int) FROM jsonb_array_elements(public.get_online_booking_slots(_slug,d::date,'pranzo')) s),'sera',(SELECT max((s->>'remaining')::int) FROM jsonb_array_elements(public.get_online_booking_slots(_slug,d::date,'sera')) s)) ORDER BY d),'[]') INTO days FROM generate_series((today+CASE WHEN r.allow_same_day_online THEN 0 ELSE 1 END)::timestamp,(today+r.booking_window_days)::timestamp,interval '1 day') d;
 RETURN jsonb_build_object('name',r.name,'address',r.public_address,'logo',r.public_logo_url,'config',r.online_config,'policy',jsonb_build_object('timezone',r.timezone,'custom_intro_text',r.custom_intro_text,'booking_window_days',r.booking_window_days,'allow_same_day_online',r.allow_same_day_online,'contact_phone',r.contact_phone,'contact_whatsapp',r.contact_whatsapp,'enable_double_shift',r.enable_double_shift,'double_shift_days',r.double_shift_days,'first_shift_duration_minutes',r.first_shift_duration_minutes,'no_show_tolerance_minutes',r.no_show_tolerance_minutes,'morning_reminder_enabled',r.morning_reminder_enabled),'shifts',jsonb_build_object('pranzo',coalesce(r.settings->'shifts'->'pranzo','{"enabled":true,"from":"12:00","to":"14:30"}'::jsonb),'sera',coalesce(r.settings->'shifts'->'sera','{"enabled":true,"from":"19:00","to":"23:00"}'::jsonb)),'today',today::text,'days',days);
END $$;
REVOKE ALL ON FUNCTION public.get_online_booking_page(text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.get_online_booking_page(text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.manage_online_reservation(_token uuid,_action text DEFAULT 'view') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.reservations; venue public.restaurants; BEGIN
 IF _action NOT IN ('view','confirm','cancel') OR _token IS NULL THEN RAISE EXCEPTION 'Link non valido'; END IF;
 SELECT * INTO r FROM public.reservations WHERE management_token=_token AND channel='online' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Link non valido'; END IF;
 SELECT * INTO venue FROM public.restaurants WHERE id=r.restaurant_id;
 IF (now() AT TIME ZONE venue.timezone)::date > r.date OR r.status<>'confirmed' OR r.arrived OR (r.deleted_at IS NOT NULL AND r.confirmation_status NOT IN ('cancellata_cliente','cancellata_no_show')) THEN RAISE EXCEPTION 'Questo link non è più disponibile'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.restaurant_id::text,0));
 IF r.confirmation_status NOT IN ('cancellata_cliente','cancellata_no_show') THEN
  IF _action='confirm' THEN UPDATE public.reservations SET confirmation_status='riconfermata' WHERE id=r.id; r.confirmation_status:='riconfermata';
  ELSIF _action='cancel' THEN UPDATE public.reservations SET confirmation_status='cancellata_cliente',deleted_at=now(),table_ids='{}' WHERE id=r.id; r.confirmation_status:='cancellata_cliente'; END IF;
 END IF;
 RETURN jsonb_build_object('restaurant',venue.name,'date',r.date,'time',r.time,'shift',r.shift,'people',r.people,'confirmation_status',r.confirmation_status);
END $$;
REVOKE ALL ON FUNCTION public.manage_online_reservation(uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.manage_online_reservation(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_morning_reminder() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.reservations; venue public.restaurants; BEGIN
 SELECT b.* INTO r FROM public.reservations b JOIN public.restaurants v ON v.id=b.restaurant_id WHERE b.channel='online' AND b.status='confirmed' AND b.deleted_at IS NULL AND NOT b.arrived AND NOT b.no_show AND b.confirmation_status='in_attesa_riconferma' AND b.contact_email IS NOT NULL AND b.contact_email<>'' AND v.morning_reminder_enabled AND b.date=(now() AT TIME ZONE v.timezone)::date AND (now() AT TIME ZONE v.timezone)::time >= '09:00'::time AND (now() AT TIME ZONE v.timezone)::time < '12:00'::time AND (b.time='' OR (now() AT TIME ZONE v.timezone)::time < b.time::time) AND b.morning_reminder_attempted_at IS NULL ORDER BY b.date,b.time,b.created_at LIMIT 1 FOR UPDATE OF b SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO venue FROM public.restaurants WHERE id=r.restaurant_id;
 UPDATE public.reservations SET morning_reminder_attempted_at=now() WHERE id=r.id;
 RETURN jsonb_build_object('id',r.id,'restaurant_id',r.restaurant_id,'restaurant',venue.name,'email',r.contact_email,'date',r.date,'time',r.time,'shift',r.shift,'people',r.people,'token',r.management_token,'whatsapp',venue.contact_whatsapp);
END $$;
REVOKE ALL ON FUNCTION public.claim_morning_reminder() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.claim_morning_reminder() TO service_role;