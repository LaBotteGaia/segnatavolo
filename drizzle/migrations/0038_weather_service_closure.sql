-- Date-specific closures use YYYY-MM-DD|shift entries, leaving recurring shifts unchanged.
CREATE OR REPLACE FUNCTION public.room_weather_closed(_room public.rooms, _date date, _shift text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT (_date::text||'|'||_shift)=ANY(coalesce(_room.closed_shifts,'{}'::text[])) $$;
GRANT EXECUTE ON FUNCTION public.room_weather_closed(public.rooms,date,text) TO authenticated,anon;
-- Extend existing availability predicates without changing their other safeguards.
DO $$ DECLARE f record; d text; n text; BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.prokind='f' AND p.proname IN ('online_slot_remaining','online_shift_remaining','online_slot_allowed','decide_online_booking','validate_online_assignment','seat_walkin_limited','seat_walkin_freed','create_walkin') LOOP
 d:=pg_get_functiondef(f.oid); n:=d;
 n:=replace(n,'_shift=ANY(r.closed_shifts)','(_shift=ANY(r.closed_shifts) OR public.room_weather_closed(r,_date,_shift))');
 n:=replace(n,'r.shift=ANY(room.closed_shifts)','(r.shift=ANY(room.closed_shifts) OR public.room_weather_closed(room,r.date,r.shift))');
 n:=replace(n,'s=ANY(coalesce(room.closed_shifts,''{}''::text[]))','(s=ANY(coalesce(room.closed_shifts,''{}''::text[])) OR public.room_weather_closed(room,rounded::date,s))');
 IF n<>d THEN EXECUTE n; END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.guard_weather_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.restaurant_id::text,0));
 IF NEW.deleted_at IS NOT NULL OR NEW.status<>'confirmed' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.table_ids IS NOT DISTINCT FROM OLD.table_ids AND NEW.date IS NOT DISTINCT FROM OLD.date AND NEW.shift IS NOT DISTINCT FROM OLD.shift THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.restaurant_tables t JOIN public.rooms ro ON ro.id=t.room_id WHERE t.id=ANY(NEW.table_ids) AND public.room_weather_closed(ro,NEW.date,NEW.shift)) THEN RAISE EXCEPTION 'Sala chiusa per maltempo in questa data e turno'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reservation_weather_guard BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_weather_assignment();
CREATE OR REPLACE FUNCTION public.close_weather_service(_rid uuid,_date date,_shift text,_expected jsonb,_plan jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r public.reservations; ro public.rooms; item jsonb; ids uuid[]; cfg jsonb; actual jsonb; cap integer; extra integer; a public.restaurant_tables; b public.restaurant_tables; k integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_configure_delivery(_rid) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Chiusura riservata al Master'; END IF;
 IF _shift NOT IN ('colazione','pranzo','sera') OR _date IS NULL OR jsonb_typeof(_plan)<>'array' THEN RAISE EXCEPTION 'Turno non valido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_rid::text,0));
 PERFORM 1 FROM public.rooms WHERE restaurant_id=_rid FOR UPDATE;
 PERFORM 1 FROM public.restaurant_tables WHERE restaurant_id=_rid FOR UPDATE;
 PERFORM 1 FROM public.reservations WHERE restaurant_id=_rid AND date=_date AND shift=_shift FOR UPDATE;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb) INTO actual FROM public.reservations x WHERE restaurant_id=_rid AND date=_date AND shift=_shift AND deleted_at IS NULL AND status='confirmed';
 IF actual IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'Prenotazioni cambiate: riapri la conferma'; END IF;
 SELECT settings INTO cfg FROM public.restaurants WHERE id=_rid;
 IF EXISTS(SELECT 1 FROM public.reservations r JOIN public.restaurant_tables t ON t.id=ANY(r.table_ids) JOIN public.rooms ro ON ro.id=t.room_id WHERE r.restaurant_id=_rid AND r.date=_date AND r.shift=_shift AND r.deleted_at IS NULL AND r.status='confirmed' AND r.tavolo_bloccato AND ro.is_outdoor) THEN RAISE EXCEPTION 'Sblocca prima le prenotazioni esterne protette dal lucchetto'; END IF;
 IF jsonb_array_length(_plan)<>(SELECT count(*) FROM public.reservations WHERE restaurant_id=_rid AND date=_date AND shift=_shift AND deleted_at IS NULL AND status='confirmed' AND NOT no_show AND NOT tavolo_bloccato) THEN RAISE EXCEPTION 'Piano incompleto'; END IF;
 IF (SELECT count(DISTINCT p->>'id') FROM jsonb_array_elements(_plan) p)<>jsonb_array_length(_plan) THEN RAISE EXCEPTION 'Piano duplicato'; END IF;
 -- Release the movable assignments together; any later failure rolls everything back.
 UPDATE public.reservations SET table_ids='{}'::uuid[] WHERE restaurant_id=_rid AND date=_date AND shift=_shift AND deleted_at IS NULL AND status='confirmed' AND NOT no_show AND NOT tavolo_bloccato;
 FOR item IN SELECT * FROM jsonb_array_elements(_plan) LOOP
 SELECT * INTO r FROM public.reservations WHERE id=(item->>'id')::uuid AND restaurant_id=_rid AND date=_date AND shift=_shift AND deleted_at IS NULL AND status='confirmed' AND NOT no_show AND NOT tavolo_bloccato;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prenotazione non valida'; END IF;
 SELECT coalesce(array_agg(v::uuid),'{}'::uuid[]) INTO ids FROM jsonb_array_elements_text(item->'ids') v;
 extra:=coalesce((item->>'extra_sponde')::integer,0);
 IF extra<0 OR extra>cardinality(ids) OR (extra>0 AND r.people<=8) THEN RAISE EXCEPTION 'Prolunghe non consentite'; END IF;
 IF cardinality(ids)<>(SELECT count(DISTINCT t.id) FROM public.restaurant_tables t JOIN public.rooms ro ON ro.id=t.room_id WHERE t.restaurant_id=_rid AND ro.restaurant_id=_rid AND t.id=ANY(ids) AND NOT ro.is_outdoor AND NOT ro.environment='esterno' AND NOT public.room_weather_closed(ro,_date,_shift) AND NOT _shift=ANY(ro.closed_shifts) AND extract(dow FROM _date)::int=ANY(ro.open_days) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ro.closed_periods) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN to_char(_date,'MM-DD') BETWEEN p->>'from' AND p->>'to' ELSE to_char(_date,'MM-DD')>=p->>'from' OR to_char(_date,'MM-DD')<=p->>'to' END)) THEN RAISE EXCEPTION 'Tavolo interno non disponibile'; END IF;
 SELECT coalesce(sum(coalesce(coperti_max,seats)),0) INTO cap FROM public.restaurant_tables WHERE restaurant_id=_rid AND id=ANY(ids);
 IF cardinality(ids)>0 AND cap+extra<r.people THEN RAISE EXCEPTION 'Capienza insufficiente'; END IF;
 IF extra>(SELECT count(*) FROM public.restaurant_tables WHERE restaurant_id=_rid AND id=ANY(ids) AND allow_extras) THEN RAISE EXCEPTION 'Prolunghe non consentite sui tavoli'; END IF;
 IF cardinality(ids)=1 AND EXISTS(SELECT 1 FROM public.restaurant_tables WHERE id=ANY(ids) AND posti_scomodi_solo_in_unione AND r.people>coperti_comodi) THEN RAISE EXCEPTION 'Posti scomodi consentiti solo in unione'; END IF;
 FOR a IN SELECT * FROM public.restaurant_tables WHERE id=ANY(ids) LOOP
 FOR b IN SELECT * FROM public.restaurant_tables WHERE id=ANY(ids) AND id>a.id LOOP
 IF a.room_id<>b.room_id OR b.id=ANY(a.no_join) OR a.id=ANY(b.no_join) OR NOT a.accoppiabile OR NOT b.accoppiabile THEN RAISE EXCEPTION 'Unione non consentita'; END IF;
 SELECT * INTO ro FROM public.rooms WHERE id=a.room_id;
 IF a.y=b.y THEN FOR k IN least(a.x,b.x)+1..greatest(a.x,b.x) LOOP IF ro.walls ? ('v:'||k||':'||a.y) OR (k<greatest(a.x,b.x) AND ro.walls ? ('o:'||k||':'||a.y)) THEN RAISE EXCEPTION 'Ostacolo tra tavoli'; END IF; END LOOP;
 ELSIF a.x=b.x THEN FOR k IN least(a.y,b.y)+1..greatest(a.y,b.y) LOOP IF ro.walls ? ('h:'||a.x||':'||k) OR (k<greatest(a.y,b.y) AND ro.walls ? ('o:'||a.x||':'||k)) THEN RAISE EXCEPTION 'Ostacolo tra tavoli'; END IF; END LOOP;
 ELSE RAISE EXCEPTION 'Tavoli non contigui'; END IF;
 END LOOP; END LOOP;
 IF EXISTS(SELECT 1 FROM public.reservations o WHERE o.restaurant_id=_rid AND o.date=_date AND o.shift=_shift AND o.id<>r.id AND o.deleted_at IS NULL AND o.status='confirmed' AND NOT o.no_show AND o.table_ids && ids AND (o.time='' OR r.time='' OR (split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int < CASE WHEN coalesce(r.duration_min,(cfg->>'duration')::int,90)<0 THEN 1440 ELSE split_part(r.time,':',1)::int*60+split_part(r.time,':',2)::int+coalesce(r.duration_min,(cfg->>'duration')::int,90)+coalesce(r.buffer_min,(cfg->>'buffer')::int,15) END AND split_part(r.time,':',1)::int*60+split_part(r.time,':',2)::int < CASE WHEN coalesce(o.duration_min,(cfg->>'duration')::int,90)<0 THEN 1440 ELSE split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int+coalesce(o.duration_min,(cfg->>'duration')::int,90)+coalesce(o.buffer_min,(cfg->>'buffer')::int,15) END))) THEN RAISE EXCEPTION 'Conflitto orario: nessuna modifica salvata'; END IF;
 UPDATE public.reservations SET table_ids=ids,outside=false,extra_sponde=extra,extra_barelle=0,ha_posti_scomodi=coalesce((item->>'ha_posti_scomodi')::boolean,false) WHERE id=r.id AND restaurant_id=_rid;
 END LOOP;
 UPDATE public.rooms SET closed_shifts=array_append(closed_shifts,_date::text||'|'||_shift) WHERE restaurant_id=_rid AND is_outdoor AND NOT public.room_weather_closed(rooms,_date,_shift);
 RETURN jsonb_build_object('closed',true);
END $$;
REVOKE ALL ON FUNCTION public.close_weather_service(uuid,date,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.close_weather_service(uuid,date,text,jsonb,jsonb) TO authenticated;