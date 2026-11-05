CREATE OR REPLACE FUNCTION public.online_slot_max_party(_rid uuid,_date date,_shift text,_time text) RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE st jsonb; mn int; dur int; buf int; md text:=to_char(_date,'MM-DD'); dow int:=extract(dow FROM _date); single int; joined int;
BEGIN
 IF _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RETURN 0; END IF;
 SELECT settings INTO st FROM public.restaurants WHERE id=_rid;
 mn:=split_part(_time,':',1)::int*60+split_part(_time,':',2)::int; dur:=coalesce((st->>'duration')::int,90); buf:=coalesce((st->>'buffer')::int,15);
 WITH free AS (
  SELECT t.room_id, t.accoppiabile, greatest(coalesce(t.coperti_max,t.seats),t.seats) cap
  FROM public.restaurant_tables t JOIN public.rooms ro ON ro.id=t.room_id AND ro.restaurant_id=_rid
  WHERE t.restaurant_id=_rid AND dow=ANY(ro.open_days) AND NOT (_shift=ANY(coalesce(ro.closed_shifts,'{}')) OR (_date::text||'|'||_shift)=ANY(coalesce(ro.closed_shifts,'{}')))
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(ro.closed_periods,'[]')) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN md BETWEEN p->>'from' AND p->>'to' ELSE md>=p->>'from' OR md<=p->>'to' END)
   AND NOT EXISTS(SELECT 1 FROM public.reservations o WHERE o.restaurant_id=_rid AND o.date=_date AND o.shift=_shift AND o.status='confirmed' AND o.deleted_at IS NULL AND NOT(o.no_show AND NOT o.arrived) AND t.id=ANY(o.table_ids)
     AND (o.time='' OR (split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int < CASE WHEN dur<0 THEN 1440 ELSE mn+dur+buf END AND mn < CASE WHEN coalesce(o.duration_min,dur)<0 THEN 1440 ELSE split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int+coalesce(o.duration_min,dur)+coalesce(o.buffer_min,buf) END)))
 )
 SELECT coalesce(max(cap),0) INTO single FROM free;
 SELECT coalesce(max(s),0) INTO joined FROM (SELECT sum(cap) s FROM (SELECT room_id,cap FROM public.restaurant_tables WHERE false) x GROUP BY room_id) y;
 RETURN single;
END $$;
REVOKE ALL ON FUNCTION public.online_slot_max_party(uuid,date,text,text) FROM PUBLIC,anon,authenticated;

DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.get_online_booking_slots(text,date,text)'::regprocedure) INTO def;
 def:=replace(def,'''turn'',public.online_slot_turn(r.id,_date,_shift,to_char(tm,''HH24:MI''))','''turn'',public.online_slot_turn(r.id,_date,_shift,to_char(tm,''HH24:MI'')),''max_table'',public.online_slot_max_party(r.id,_date,_shift,to_char(tm,''HH24:MI''))');
 IF position('max_table' in def)=0 THEN RAISE EXCEPTION 'slots patch failed'; END IF;
 EXECUTE def;
 SELECT pg_get_functiondef('public.submit_online_booking(text,jsonb)'::regprocedure) INTO def;
 EXECUTE replace(def,'public.submit_online_booking(','public.submit_online_booking_before_table_cap(');
END $$;
REVOKE ALL ON FUNCTION public.submit_online_booking_before_table_cap(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.submit_online_booking(_slug text,_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; existing uuid;
BEGIN
 SELECT id INTO rid FROM public.restaurants WHERE web_slug=_slug AND online_enabled;
 IF rid IS NULL THEN RAISE EXCEPTION 'Canale online non disponibile'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,0));
 SELECT id INTO existing FROM public.reservations WHERE restaurant_id=rid AND online_request_id=(_data->>'request_id')::uuid;
 IF existing IS NULL AND public.online_slot_max_party(rid,(_data->>'date')::date,_data->>'shift',_data->>'time')<(_data->>'people')::int THEN
  RAISE EXCEPTION 'Nessun tavolo disponibile per % persone in questo orario: scegli un orario alternativo', (_data->>'people')::int;
 END IF;
 RETURN public.submit_online_booking_before_table_cap(_slug,_data);
END $$;
REVOKE ALL ON FUNCTION public.submit_online_booking(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_online_booking(text,jsonb) TO anon,authenticated,service_role;