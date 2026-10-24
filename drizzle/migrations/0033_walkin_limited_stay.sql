ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS max_stay_until text;

CREATE OR REPLACE FUNCTION public.seat_walkin_limited(_people integer, _table uuid, _name text DEFAULT 'Passante'::text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE rid uuid; cfg jsonb; local_now timestamp; rounded timestamp; s text; hh text; room public.rooms; now_min integer; next_min integer; buf integer; until_min integer;
BEGIN
 rid := coalesce(public.my_restaurant_id(), CASE WHEN public.is_super_admin() THEN (SELECT t.restaurant_id FROM public.restaurant_tables t WHERE t.id=_table) END);
 IF auth.uid() IS NULL OR rid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
 IF _people IS NULL OR _people<1 THEN RAISE EXCEPTION 'Inserisci almeno una persona'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,0));
 SELECT settings INTO cfg FROM public.restaurants WHERE id=rid;
 buf := coalesce((cfg->>'buffer')::integer,15);
 local_now := now() AT TIME ZONE 'Europe/Rome';
 rounded := date_trunc('hour',local_now) + round(extract(minute FROM local_now)/5.0)*interval '5 minutes';
 hh := to_char(rounded,'HH24:MI');
 now_min := extract(hour FROM rounded)*60+extract(minute FROM rounded);
 SELECT sh INTO s FROM unnest(ARRAY['colazione','pranzo','sera']) sh WHERE coalesce((cfg->'shifts'->sh->>'enabled')::boolean, sh<>'colazione') AND hh BETWEEN coalesce(cfg->'shifts'->sh->>'from',CASE sh WHEN 'colazione' THEN '07:30' WHEN 'pranzo' THEN '12:00' ELSE '19:00' END) AND coalesce(cfg->'shifts'->sh->>'to',CASE sh WHEN 'colazione' THEN '10:30' WHEN 'pranzo' THEN '14:30' ELSE '23:00' END) LIMIT 1;
 IF s IS NULL THEN s := CASE WHEN hh>='16:00' THEN 'sera' ELSE 'pranzo' END; END IF;
 IF NOT coalesce((cfg->'shifts'->s->>'enabled')::boolean,s<>'colazione') THEN RAISE EXCEPTION 'Turno non attivo'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(cfg->'holidays','[]'::jsonb)) h WHERE rounded::date BETWEEN (h->>'from')::date AND (h->>'to')::date) OR coalesce(cfg->'weekly'->(extract(dow FROM rounded)::integer::text),'[]'::jsonb) ? s THEN RAISE EXCEPTION 'Servizio chiuso'; END IF;
 SELECT ro.* INTO room FROM public.rooms ro JOIN public.restaurant_tables t ON t.room_id=ro.id WHERE t.id=_table AND t.restaurant_id=rid AND ro.restaurant_id=rid AND t.seats>=_people;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tavolo non disponibile per questi coperti'; END IF;
 IF s=ANY(coalesce(room.closed_shifts,'{}'::text[])) OR (room.open_days IS NOT NULL AND NOT extract(dow FROM rounded)::integer=ANY(room.open_days)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(room.closed_periods,'[]'::jsonb)) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN to_char(rounded,'MM-DD') BETWEEN p->>'from' AND p->>'to' ELSE to_char(rounded,'MM-DD')>=p->>'from' OR to_char(rounded,'MM-DD')<=p->>'to' END) THEN RAISE EXCEPTION 'Sala chiusa'; END IF;
 -- Nessuno deve occupare il tavolo adesso.
 IF EXISTS(SELECT 1 FROM public.reservations o WHERE o.restaurant_id=rid AND o.date=rounded::date AND o.shift=s AND o.deleted_at IS NULL AND NOT o.no_show AND _table=ANY(o.table_ids) AND (o.time='' OR (split_part(o.time,':',1)::integer*60+split_part(o.time,':',2)::integer <= now_min AND now_min < CASE WHEN coalesce(o.duration_min,(cfg->>'duration')::integer,90)<0 THEN 1440 ELSE split_part(o.time,':',1)::integer*60+split_part(o.time,':',2)::integer+coalesce(o.duration_min,(cfg->>'duration')::integer,90)+coalesce(o.buffer_min,buf) END))) THEN RAISE EXCEPTION 'Il tavolo è occupato in questo momento'; END IF;
 SELECT min(split_part(o.time,':',1)::integer*60+split_part(o.time,':',2)::integer) INTO next_min FROM public.reservations o WHERE o.restaurant_id=rid AND o.date=rounded::date AND o.shift=s AND o.deleted_at IS NULL AND NOT o.no_show AND _table=ANY(o.table_ids) AND o.time<>'' AND split_part(o.time,':',1)::integer*60+split_part(o.time,':',2)::integer > now_min;
 IF next_min IS NULL THEN RAISE EXCEPTION 'Nessuna prenotazione successiva: usa l''accomodamento normale'; END IF;
 until_min := next_min - buf;
 IF until_min - now_min < 15 THEN RAISE EXCEPTION 'Tempo disponibile insufficiente prima della prossima prenotazione'; END IF;
 INSERT INTO public.reservations(restaurant_id,date,shift,time,name,people,table_ids,arrived,duration_min,buffer_min,customer_id,phone,is_new,outside,max_stay_until)
 VALUES(rid,rounded::date,s,hh,coalesce(nullif(trim(_name),''),'Passante'),_people,ARRAY[_table],true,until_min-now_min,buf,NULL,NULL,false,room.environment='esterno',to_char(make_time(until_min/60,until_min%60,0),'HH24:MI'));
 RETURN to_char(make_time(until_min/60,until_min%60,0),'HH24:MI');
END $function$;
GRANT EXECUTE ON FUNCTION public.seat_walkin_limited(integer, uuid, text) TO authenticated;