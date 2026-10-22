DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.submit_online_booking_original(text,jsonb)'::regprocedure) INTO def; def:=replace(def,'public.online_shift_remaining(rid,dt,sh)','public.online_slot_remaining(rid,dt,sh,tm)'); EXECUTE def; END $$;
CREATE OR REPLACE FUNCTION public.get_online_booking_page(_slug text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.restaurants; days jsonb; today date:=(now() AT TIME ZONE 'Europe/Rome')::date;
BEGIN
 IF _slug !~ '^[a-z0-9][a-z0-9-]{1,79}$' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.restaurants WHERE web_slug=lower(_slug) AND online_enabled;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT jsonb_agg(jsonb_build_object('date',d::date::text,'pranzo',(SELECT max((s->>'remaining')::int) FROM jsonb_array_elements(public.get_online_booking_slots(_slug,d::date,'pranzo')) s),'sera',(SELECT max((s->>'remaining')::int) FROM jsonb_array_elements(public.get_online_booking_slots(_slug,d::date,'sera')) s)) ORDER BY d) INTO days FROM generate_series(today::timestamp,(today+coalesce((r.online_config->>'max_days')::int,30))::timestamp,interval '1 day') d;
 RETURN jsonb_build_object('name',r.name,'address',r.public_address,'logo',r.public_logo_url,'config',r.online_config,'shifts',jsonb_build_object('pranzo',coalesce(r.settings->'shifts'->'pranzo','{"enabled":true,"from":"12:00","to":"14:30"}'::jsonb),'sera',coalesce(r.settings->'shifts'->'sera','{"enabled":true,"from":"19:00","to":"23:00"}'::jsonb)),'today',today::text,'days',days);
END $$;
CREATE OR REPLACE FUNCTION public.validate_online_assignment(_rid uuid,_id uuid,_tables uuid[],_extras jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.restaurant_tables; b public.restaurant_tables; room public.rooms; k int; r public.reservations; cap int:=0; count_used int; st jsonb; dow int; md text;
BEGIN
 SELECT * INTO r FROM public.reservations WHERE restaurant_id=_rid AND id=_id;
 SELECT settings INTO st FROM public.restaurants WHERE id=_rid;
 dow:=extract(dow FROM r.date); md:=to_char(r.date,'MM-DD');
 FOR room IN SELECT * FROM public.rooms WHERE restaurant_id=_rid LOOP
  IF NOT dow=ANY(room.open_days) OR r.shift=ANY(room.closed_shifts) OR EXISTS(SELECT 1 FROM jsonb_array_elements(room.closed_periods) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN md BETWEEN p->>'from' AND p->>'to' ELSE md>=p->>'from' OR md<=p->>'to' END) THEN CONTINUE; END IF;
  cap:=cap+coalesce(room.capacity,(SELECT sum(seats)::int FROM public.restaurant_tables WHERE room_id=room.id AND restaurant_id=_rid),0);
 END LOOP;
 SELECT coalesce(sum(people),0) INTO count_used FROM public.reservations o WHERE restaurant_id=_rid AND date=r.date AND shift=r.shift AND deleted_at IS NULL AND status IN ('pending','confirmed') AND NOT(no_show AND NOT arrived) AND (o.time='' OR (split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int < CASE WHEN coalesce(r.duration_min,(st->>'duration')::int,90)<0 THEN 1440 ELSE split_part(r.time,':',1)::int*60+split_part(r.time,':',2)::int+coalesce(r.duration_min,(st->>'duration')::int,90)+coalesce(r.buffer_min,(st->>'buffer')::int,15) END AND split_part(r.time,':',1)::int*60+split_part(r.time,':',2)::int < CASE WHEN coalesce(o.duration_min,(st->>'duration')::int,90)<0 THEN 1440 ELSE split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int+coalesce(o.duration_min,(st->>'duration')::int,90)+coalesce(o.buffer_min,(st->>'buffer')::int,15) END));
 IF count_used>greatest(0,cap-coalesce((st->>'reserve')::int,4)) THEN RAISE EXCEPTION 'Capienza cambiata: controlla le richieste e i coperti prima di confermare'; END IF;
 IF coalesce((_extras->>'extra_sponde')::int,0)+coalesce((_extras->>'extra_barelle')::int,0)>0 AND NOT EXISTS(SELECT 1 FROM public.restaurant_tables WHERE restaurant_id=_rid AND id=ANY(_tables) AND allow_extras) THEN RAISE EXCEPTION 'I tavoli scelti non consentono posti extra'; END IF;
 FOR a IN SELECT * FROM public.restaurant_tables WHERE restaurant_id=_rid AND id=ANY(_tables) LOOP
  FOR b IN SELECT * FROM public.restaurant_tables WHERE restaurant_id=_rid AND id=ANY(_tables) AND id>a.id LOOP
   IF b.id=ANY(a.no_join) OR a.id=ANY(b.no_join) THEN RAISE EXCEPTION 'Vincolo di unione tavoli'; END IF;
   IF a.room_id=b.room_id THEN
    SELECT * INTO room FROM public.rooms WHERE id=a.room_id;
    IF a.y=b.y THEN
     FOR k IN least(a.x,b.x)+1..greatest(a.x,b.x) LOOP IF room.walls ? ('v:'||k||':'||a.y) OR (k<greatest(a.x,b.x) AND room.walls ? ('o:'||k||':'||a.y)) THEN RAISE EXCEPTION 'Ostacolo tra i tavoli scelti'; END IF; END LOOP;
    ELSIF a.x=b.x THEN
     FOR k IN least(a.y,b.y)+1..greatest(a.y,b.y) LOOP IF room.walls ? ('h:'||a.x||':'||k) OR (k<greatest(a.y,b.y) AND room.walls ? ('o:'||a.x||':'||k)) THEN RAISE EXCEPTION 'Ostacolo tra i tavoli scelti'; END IF; END LOOP;
    END IF;
   END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_online_assignment(uuid,uuid,uuid[],jsonb) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.decide_online_booking(uuid,uuid,boolean,uuid[],jsonb,text)'::regprocedure) INTO def; def:=replace(def,'IF _accept THEN','IF _accept THEN PERFORM public.validate_online_assignment(_restaurant_id,_id,_tables,_extras);'); EXECUTE def; END $$;