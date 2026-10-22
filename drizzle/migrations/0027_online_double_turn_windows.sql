CREATE OR REPLACE FUNCTION public.online_slot_turn(_rid uuid,_date date,_shift text,_time text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE st jsonb; cfg jsonb; doubled boolean; first_to text; second_from text; dur int; buf int; mn int; second_mn int; dow int:=extract(dow FROM _date); md text:=to_char(_date,'MM-DD');
BEGIN
 IF _shift NOT IN ('pranzo','sera') OR _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RETURN NULL; END IF;
 SELECT settings,online_config INTO st,cfg FROM public.restaurants WHERE id=_rid AND online_enabled;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT EXISTS(SELECT 1 FROM public.rooms r CROSS JOIN LATERAL jsonb_array_elements(r.double_shifts) d WHERE r.restaurant_id=_rid AND dow=ANY(r.open_days) AND NOT(_shift=ANY(r.closed_shifts)) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.closed_periods) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN md BETWEEN p->>'from' AND p->>'to' ELSE md>=p->>'from' OR md<=p->>'to' END) AND d->'shifts' ? _shift AND (jsonb_array_length(d->'days')=0 OR d->'days' @> to_jsonb(ARRAY[dow])) AND (coalesce(d->>'from','')='' OR coalesce(d->>'to','')='' OR CASE WHEN d->>'from'<=d->>'to' THEN md BETWEEN d->>'from' AND d->>'to' ELSE md>=d->>'from' OR md<=d->>'to' END)) INTO doubled;
 IF NOT doubled THEN RETURN 0; END IF;
 first_to:=coalesce(cfg->'double_windows'->_shift->>'first_to',CASE WHEN _shift='pranzo' THEN '12:45' ELSE '19:45' END);
 second_from:=coalesce(cfg->'double_windows'->_shift->>'second_from',CASE WHEN _shift='pranzo' THEN '14:30' ELSE '21:30' END);
 dur:=coalesce((st->>'duration')::int,90); buf:=coalesce((st->>'buffer')::int,15);
 mn:=split_part(_time,':',1)::int*60+split_part(_time,':',2)::int;
 second_mn:=split_part(second_from,':',1)::int*60+split_part(second_from,':',2)::int;
 IF _time>=second_from THEN RETURN 2; END IF;
 IF _time<=first_to AND dur>=0 AND mn+dur+buf<=second_mn THEN RETURN 1; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.online_slot_turn(uuid,date,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.online_slot_turn(uuid,date,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.get_online_booking_slots(_slug text,_date date,_shift text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.restaurants; result jsonb; f time; t time;
BEGIN
 SELECT * INTO r FROM public.restaurants WHERE web_slug=_slug AND online_enabled;
 IF NOT FOUND OR _shift NOT IN ('pranzo','sera') THEN RETURN '[]'::jsonb; END IF;
 f:=coalesce(r.settings->'shifts'->_shift->>'from',CASE WHEN _shift='pranzo' THEN '12:00' ELSE '19:00' END)::time;
 t:=coalesce(r.settings->'shifts'->_shift->>'to',CASE WHEN _shift='pranzo' THEN '14:30' ELSE '23:00' END)::time;
 SELECT coalesce(jsonb_agg(jsonb_build_object('time',to_char(tm,'HH24:MI'),'remaining',public.online_slot_remaining(r.id,_date,_shift,to_char(tm,'HH24:MI')),'turn',public.online_slot_turn(r.id,_date,_shift,to_char(tm,'HH24:MI'))) ORDER BY tm),'[]') INTO result FROM generate_series(_date+f,_date+t,interval '15 minutes') tm WHERE public.online_slot_turn(r.id,_date,_shift,to_char(tm,'HH24:MI')) IS NOT NULL;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_online_booking_slots(text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_booking_slots(text,date,text) TO anon,authenticated,service_role;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.submit_online_booking(text,jsonb)'::regprocedure) INTO def; def:=replace(def,'remaining:=public.online_slot_remaining','IF public.online_slot_turn(rid,(_data->>''date'')::date,_data->>''shift'',_data->>''time'') IS NULL THEN RAISE EXCEPTION ''Orario intermedio non prenotabile: scegli primo o secondo turno''; END IF;
 remaining:=public.online_slot_remaining'); EXECUTE def; END $$;
CREATE OR REPLACE FUNCTION public.validate_online_double_windows() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sh text; w jsonb; first_to text; second_from text;
BEGIN
 FOREACH sh IN ARRAY ARRAY['pranzo','sera'] LOOP
 w:=NEW.online_config->'double_windows'->sh;
 IF w IS NULL THEN CONTINUE; END IF;
 first_to:=w->>'first_to'; second_from:=w->>'second_from';
 IF first_to IS NULL OR second_from IS NULL OR first_to !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR second_from !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR first_to>=second_from THEN RAISE EXCEPTION 'Finestre doppio turno non valide'; END IF;
 IF split_part(first_to,':',2)::int%15<>0 OR split_part(second_from,':',2)::int%15<>0 OR coalesce((NEW.settings->>'duration')::int,90)<0 OR split_part(first_to,':',1)::int*60+split_part(first_to,':',2)::int+coalesce((NEW.settings->>'duration')::int,90)+coalesce((NEW.settings->>'buffer')::int,15)>split_part(second_from,':',1)::int*60+split_part(second_from,':',2)::int THEN RAISE EXCEPTION 'Lascia durata tavolo e margine pulizia tra i due turni'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_online_double_windows BEFORE INSERT OR UPDATE OF online_config ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.validate_online_double_windows();