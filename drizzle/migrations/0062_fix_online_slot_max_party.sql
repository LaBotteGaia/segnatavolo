CREATE OR REPLACE FUNCTION public.online_slot_max_party(_rid uuid,_date date,_shift text,_time text) RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE st jsonb; mn int; dur int; buf int; md text:=to_char(_date,'MM-DD'); dow int:=extract(dow FROM _date); single int;
BEGIN
 IF _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RETURN 0; END IF;
 SELECT settings INTO st FROM public.restaurants WHERE id=_rid;
 mn:=split_part(_time,':',1)::int*60+split_part(_time,':',2)::int; dur:=coalesce((st->>'duration')::int,90); buf:=coalesce((st->>'buffer')::int,15);
 SELECT coalesce(max(greatest(coalesce(t.coperti_max,t.seats),t.seats)),0) INTO single
  FROM public.restaurant_tables t JOIN public.rooms ro ON ro.id=t.room_id AND ro.restaurant_id=_rid
  WHERE t.restaurant_id=_rid AND dow=ANY(ro.open_days) AND NOT (_shift=ANY(coalesce(ro.closed_shifts,'{}')) OR (_date::text||'|'||_shift)=ANY(coalesce(ro.closed_shifts,'{}')))
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(ro.closed_periods,'[]')) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN md BETWEEN p->>'from' AND p->>'to' ELSE md>=p->>'from' OR md<=p->>'to' END)
   AND NOT EXISTS(SELECT 1 FROM public.reservations o WHERE o.restaurant_id=_rid AND o.date=_date AND o.shift=_shift AND o.status='confirmed' AND o.deleted_at IS NULL AND NOT(o.no_show AND NOT o.arrived) AND t.id=ANY(o.table_ids)
     AND (o.time='' OR (split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int < CASE WHEN dur<0 THEN 1440 ELSE mn+dur+buf END AND mn < CASE WHEN coalesce(o.duration_min,dur)<0 THEN 1440 ELSE split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int+coalesce(o.duration_min,dur)+coalesce(o.buffer_min,buf) END)));
 RETURN single;
END $$;
REVOKE ALL ON FUNCTION public.online_slot_max_party(uuid,date,text,text) FROM PUBLIC,anon,authenticated;