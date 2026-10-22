ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed', ADD COLUMN IF NOT EXISTS rejection_reason text, ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_booking_status CHECK (status IN ('pending','confirmed','rejected'));
CREATE INDEX IF NOT EXISTS reservations_pending_restaurant ON public.reservations(restaurant_id,date) WHERE status='pending' AND deleted_at IS NULL;
CREATE OR REPLACE FUNCTION public.online_slot_remaining(_rid uuid,_date date,_shift text,_time text,_exclude uuid DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE st jsonb; cfg jsonb; r record; physical integer:=0; total_cap integer:=0; occupied integer; service_booked integer; doubled boolean; md text:=to_char(_date,'MM-DD'); dow integer:=extract(dow FROM _date); sh jsonb; start_at timestamptz; deadline timestamptz; today date:=(now() AT TIME ZONE 'Europe/Rome')::date; mn integer; dur integer; buf integer;
BEGIN
 SELECT settings,online_config INTO st,cfg FROM public.restaurants WHERE id=_rid AND online_enabled;
 IF NOT FOUND OR _shift NOT IN ('pranzo','sera') OR _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR _date<today OR _date>today+coalesce((cfg->>'max_days')::int,30) THEN RETURN NULL; END IF;
 sh:=st->'shifts'->_shift;
 IF NOT coalesce((sh->>'enabled')::boolean,true) OR coalesce(st->'weekly'->dow::text,'[]'::jsonb) ? _shift OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(st->'holidays','[]')) h WHERE _date::text BETWEEN h->>'from' AND h->>'to') THEN RETURN NULL; END IF;
 IF _time<coalesce(sh->>'from',CASE WHEN _shift='pranzo' THEN '12:00' ELSE '19:00' END) OR _time>coalesce(sh->>'to',CASE WHEN _shift='pranzo' THEN '14:30' ELSE '23:00' END) OR extract(minute FROM _time::time)::int%15<>0 THEN RETURN NULL; END IF;
 start_at:=(_date::text||' '||coalesce(sh->>'from',CASE WHEN _shift='pranzo' THEN '12:00' ELSE '19:00' END))::timestamp AT TIME ZONE 'Europe/Rome';
 deadline:=CASE coalesce(cfg->>'cutoff','hours') WHEN 'previous_day' THEN _date::timestamp AT TIME ZONE 'Europe/Rome' WHEN '24h' THEN start_at-interval '24 hours' WHEN '48h' THEN start_at-interval '48 hours' ELSE start_at-make_interval(hours=>coalesce((cfg->>'cutoff_hours')::int,2)) END;
 IF now()>=deadline THEN RETURN NULL; END IF;
 FOR r IN SELECT * FROM public.rooms WHERE restaurant_id=_rid LOOP
  IF NOT dow=ANY(r.open_days) OR _shift=ANY(r.closed_shifts) OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.closed_periods) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN md BETWEEN p->>'from' AND p->>'to' ELSE md>=p->>'from' OR md<=p->>'to' END) THEN CONTINUE; END IF;
  SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(r.double_shifts) d WHERE d->'shifts' ? _shift AND (jsonb_array_length(d->'days')=0 OR d->'days' @> to_jsonb(ARRAY[dow])) AND (coalesce(d->>'from','')='' OR coalesce(d->>'to','')='' OR CASE WHEN d->>'from'<=d->>'to' THEN md BETWEEN d->>'from' AND d->>'to' ELSE md>=d->>'from' OR md<=d->>'to' END)) INTO doubled;
  physical:=physical+coalesce(r.capacity,(SELECT sum(seats)::int FROM public.restaurant_tables WHERE restaurant_id=_rid AND room_id=r.id),0);
  total_cap:=total_cap+coalesce(r.capacity,(SELECT sum(seats)::int FROM public.restaurant_tables WHERE restaurant_id=_rid AND room_id=r.id),0)*(CASE WHEN doubled THEN 2 ELSE 1 END);
 END LOOP;
 IF physical=0 THEN RETURN NULL; END IF;
 mn:=split_part(_time,':',1)::int*60+split_part(_time,':',2)::int; dur:=coalesce((st->>'duration')::int,90); buf:=coalesce((st->>'buffer')::int,15);
 SELECT coalesce(sum(people),0),coalesce(sum(people) FILTER(WHERE time='' OR (split_part(time,':',1)::int*60+split_part(time,':',2)::int < CASE WHEN dur<0 THEN 1440 ELSE mn+dur+buf END AND mn < CASE WHEN coalesce(duration_min,dur)<0 THEN 1440 ELSE split_part(time,':',1)::int*60+split_part(time,':',2)::int+coalesce(duration_min,dur)+coalesce(buffer_min,buf) END)),0) INTO service_booked,occupied FROM public.reservations WHERE restaurant_id=_rid AND date=_date AND shift=_shift AND deleted_at IS NULL AND status IN ('pending','confirmed') AND NOT(no_show AND NOT arrived) AND (_exclude IS NULL OR id<>_exclude);
 RETURN greatest(0,least(physical-coalesce((st->>'reserve')::int,4)-occupied,total_cap-coalesce((st->>'reserve')::int,4)-service_booked));
END $$;
REVOKE ALL ON FUNCTION public.online_slot_remaining(uuid,date,text,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_online_booking_slots(_slug text,_date date,_shift text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.restaurants; result jsonb; f time; t time;
BEGIN
 SELECT * INTO r FROM public.restaurants WHERE web_slug=_slug AND online_enabled;
 IF NOT FOUND OR _shift NOT IN ('pranzo','sera') THEN RETURN '[]'::jsonb; END IF;
 f:=coalesce(r.settings->'shifts'->_shift->>'from',CASE WHEN _shift='pranzo' THEN '12:00' ELSE '19:00' END)::time;
 t:=coalesce(r.settings->'shifts'->_shift->>'to',CASE WHEN _shift='pranzo' THEN '14:30' ELSE '23:00' END)::time;
 SELECT coalesce(jsonb_agg(jsonb_build_object('time',to_char(tm,'HH24:MI'),'remaining',public.online_slot_remaining(r.id,_date,_shift,to_char(tm,'HH24:MI'))) ORDER BY tm),'[]') INTO result FROM generate_series(_date+f,_date+t,interval '15 minutes') tm;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_online_booking_slots(text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_booking_slots(text,date,text) TO anon,authenticated,service_role;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.submit_online_booking(text,jsonb)'::regprocedure) INTO def; EXECUTE replace(def,'public.submit_online_booking(', 'public.submit_online_booking_original('); END $$;
REVOKE ALL ON FUNCTION public.submit_online_booking_original(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.submit_online_booking(_slug text,_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; cfg jsonb; res jsonb; existing uuid; remaining integer; pax integer;
BEGIN
 SELECT id,online_config INTO rid,cfg FROM public.restaurants WHERE web_slug=_slug AND online_enabled;
 IF rid IS NULL THEN RAISE EXCEPTION 'Canale online non disponibile'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,0));
 SELECT id INTO existing FROM public.reservations WHERE restaurant_id=rid AND online_request_id=(_data->>'request_id')::uuid;
 IF existing IS NOT NULL THEN RETURN jsonb_build_object('id',existing,'status','pending','duplicate',true); END IF;
 pax:=(_data->>'people')::int;
 IF pax>coalesce((cfg->>'max_party_size')::int,6) THEN RAISE EXCEPTION 'Per grandi comitive contatta direttamente il ristorante'; END IF;
 remaining:=public.online_slot_remaining(rid,(_data->>'date')::date,_data->>'shift',_data->>'time');
 IF remaining IS NULL OR remaining<pax THEN RAISE EXCEPTION 'Nessun tavolo disponibile per l’orario selezionato'; END IF;
 res:=public.submit_online_booking_original(_slug,_data);
 PERFORM set_config('segnatavolo.online_decision','on',true);
 UPDATE public.reservations SET status='pending' WHERE restaurant_id=rid AND id=(res->>'id')::uuid;
 PERFORM set_config('segnatavolo.online_decision','off',true);
 RETURN res||jsonb_build_object('status','pending','duplicate',false);
END $$;
CREATE OR REPLACE FUNCTION public.guard_online_request() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_setting('segnatavolo.restore',true)='on' AND public.is_super_admin() THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND (OLD.status<>'confirmed' OR NEW.status<>OLD.status) AND current_setting('segnatavolo.online_decision',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Usa i comandi di approvazione della richiesta online'; END IF;
 IF TG_OP='INSERT' AND NEW.status<>'confirmed' AND current_setting('segnatavolo.online_decision',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Stato non autorizzato'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_online_booking BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_online_request();
CREATE OR REPLACE FUNCTION public.decide_online_booking(_restaurant_id uuid,_id uuid,_accept boolean,_tables uuid[] DEFAULT '{}',_extras jsonb DEFAULT '{}',_reason text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reservations; st jsonb; d int; b int; conflict boolean; cap int; operator_name text;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.is_super_admin() OR EXISTS(SELECT 1 FROM public.restaurant_members WHERE restaurant_id=_restaurant_id AND user_id=auth.uid() AND status='active')) THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_restaurant_id::text,0));
 SELECT * INTO r FROM public.reservations WHERE id=_id AND restaurant_id=_restaurant_id AND channel='online' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Richiesta già gestita o non disponibile'; END IF;
 IF NOT _accept AND length(trim(_reason)) NOT BETWEEN 2 AND 1000 THEN RAISE EXCEPTION 'Inserisci una motivazione'; END IF;
 IF _accept THEN
  IF cardinality(_tables)=0 OR cardinality(_tables)<>(SELECT count(DISTINCT v) FROM unnest(_tables) v) OR EXISTS(SELECT 1 FROM unnest(_tables) tid WHERE NOT EXISTS(SELECT 1 FROM public.restaurant_tables WHERE id=tid AND restaurant_id=_restaurant_id)) THEN RAISE EXCEPTION 'Seleziona tavoli validi'; END IF;
  SELECT settings INTO st FROM public.restaurants WHERE id=_restaurant_id; d:=coalesce((st->>'duration')::int,90); b:=coalesce((st->>'buffer')::int,15);
  IF coalesce((_extras->>'extra_sponde')::int,0) NOT BETWEEN 0 AND 20 OR coalesce((_extras->>'extra_barelle')::int,0) NOT BETWEEN 0 AND 20 OR coalesce((_extras->>'barella_seats')::int,2) NOT BETWEEN 0 AND 20 THEN RAISE EXCEPTION 'Posti extra non validi'; END IF;
  SELECT coalesce(sum(seats),0) INTO cap FROM public.restaurant_tables WHERE restaurant_id=_restaurant_id AND id=ANY(_tables);
  IF cap+coalesce((_extras->>'extra_sponde')::int,0)+coalesce((_extras->>'extra_barelle')::int,0)*coalesce((_extras->>'barella_seats')::int,2)<r.people THEN RAISE EXCEPTION 'Tavoli insufficienti per i coperti richiesti'; END IF;
  IF EXISTS(SELECT 1 FROM public.restaurant_tables t JOIN public.rooms room ON room.id=t.room_id WHERE t.id=ANY(_tables) AND (NOT extract(dow FROM r.date)::int=ANY(room.open_days) OR r.shift=ANY(room.closed_shifts) OR EXISTS(SELECT 1 FROM jsonb_array_elements(room.closed_periods) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN to_char(r.date,'MM-DD') BETWEEN p->>'from' AND p->>'to' ELSE to_char(r.date,'MM-DD')>=p->>'from' OR to_char(r.date,'MM-DD')<=p->>'to' END))) THEN RAISE EXCEPTION 'Una sala selezionata è chiusa'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.reservations o WHERE o.restaurant_id=_restaurant_id AND o.date=r.date AND o.status='confirmed' AND o.deleted_at IS NULL AND NOT(o.no_show AND NOT o.arrived) AND o.id<>r.id AND o.table_ids && _tables AND (r.time='' OR o.time='' OR (split_part(r.time,':',1)::int*60+split_part(r.time,':',2)::int < CASE WHEN coalesce(o.duration_min,d)<0 THEN 1440 ELSE split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int+coalesce(o.duration_min,d)+coalesce(o.buffer_min,b) END AND split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int < CASE WHEN coalesce(r.duration_min,d)<0 THEN 1440 ELSE split_part(r.time,':',1)::int*60+split_part(r.time,':',2)::int+coalesce(r.duration_min,d)+coalesce(r.buffer_min,b) END))) INTO conflict;
  IF conflict THEN RAISE EXCEPTION 'Il tavolo è stato occupato: scegli un altro tavolo'; END IF;
 END IF;
 PERFORM set_config('segnatavolo.online_decision','on',true);
 UPDATE public.reservations SET status=CASE WHEN _accept THEN 'confirmed' ELSE 'rejected' END,table_ids=CASE WHEN _accept THEN _tables ELSE '{}' END,extra_sponde=CASE WHEN _accept THEN coalesce((_extras->>'extra_sponde')::int,0) ELSE 0 END,extra_barelle=CASE WHEN _accept THEN coalesce((_extras->>'extra_barelle')::int,0) ELSE 0 END,barella_seats=coalesce((_extras->>'barella_seats')::int,2),rejection_reason=CASE WHEN _accept THEN NULL ELSE trim(_reason) END,decided_at=now() WHERE id=r.id;
 PERFORM set_config('segnatavolo.online_decision','off',true);
 RETURN jsonb_build_object('id',r.id,'status',CASE WHEN _accept THEN 'confirmed' ELSE 'rejected' END);
END $$;
REVOKE ALL ON FUNCTION public.decide_online_booking(uuid,uuid,boolean,uuid[],jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_online_booking(uuid,uuid,boolean,uuid[],jsonb,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.validate_online_party_limit() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF coalesce((NEW.online_config->>'max_party_size')::int,6) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Limite comitiva non valido'; END IF; RETURN NEW; END $$;
CREATE TRIGGER validate_online_party_limit BEFORE INSERT OR UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.validate_online_party_limit();