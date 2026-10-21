ALTER TABLE public.reservations ADD COLUMN deleted_at timestamptz;
CREATE INDEX reservations_deleted_day ON public.reservations (restaurant_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.stamp_reservation_deletion() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN NEW.deleted_at := now();
 ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NOT NULL THEN NEW.deleted_at := OLD.deleted_at;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stamp_reservation_deletion BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.stamp_reservation_deletion();
CREATE OR REPLACE FUNCTION public.restore_service_reservation(_id uuid, _without_tables boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r public.reservations; cfg jsonb; d integer; b integer; conflict boolean;
BEGIN
 IF auth.uid() IS NULL OR public.my_restaurant_id() IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(public.my_restaurant_id()::text, 0));
 SELECT * INTO r FROM public.reservations WHERE id=_id AND restaurant_id=public.my_restaurant_id() AND deleted_at IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prenotazione non disponibile nel cestino'; END IF;
 SELECT settings INTO cfg FROM public.restaurants WHERE id=r.restaurant_id;
 d := coalesce((cfg->>'duration')::integer,90); b := coalesce((cfg->>'buffer')::integer,15);
 SELECT EXISTS(SELECT 1 FROM public.reservations o WHERE o.restaurant_id=r.restaurant_id AND o.date=r.date AND o.shift=r.shift AND o.deleted_at IS NULL AND NOT o.no_show AND o.id<>r.id AND o.table_ids && r.table_ids AND (r.time='' OR o.time='' OR ((split_part(r.time,':',1)::integer*60+split_part(r.time,':',2)::integer) < CASE WHEN coalesce(o.duration_min,d)<0 THEN 1440 ELSE split_part(o.time,':',1)::integer*60+split_part(o.time,':',2)::integer+coalesce(o.duration_min,d)+coalesce(o.buffer_min,b) END AND (split_part(o.time,':',1)::integer*60+split_part(o.time,':',2)::integer) < CASE WHEN coalesce(r.duration_min,d)<0 THEN 1440 ELSE split_part(r.time,':',1)::integer*60+split_part(r.time,':',2)::integer+coalesce(r.duration_min,d)+coalesce(r.buffer_min,b) END))) INTO conflict;
 IF EXISTS(SELECT 1 FROM unnest(r.table_ids) tid WHERE NOT EXISTS(SELECT 1 FROM public.restaurant_tables t WHERE t.id=tid AND t.restaurant_id=r.restaurant_id)) THEN conflict := true; END IF;
 IF conflict AND NOT _without_tables THEN RETURN false; END IF;
 UPDATE public.reservations SET deleted_at=NULL, table_ids=CASE WHEN _without_tables THEN '{}'::uuid[] ELSE r.table_ids END WHERE id=r.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.restore_service_reservation(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_service_reservation(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_service_walkin(_people integer, _table uuid, _name text DEFAULT 'Passante') RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE rid uuid; cfg jsonb; local_now timestamp; rounded timestamp; s text; hh text; result uuid; room public.rooms;
BEGIN
 rid := public.my_restaurant_id();
 IF auth.uid() IS NULL OR rid IS NULL THEN RAISE EXCEPTION 'Accesso richiesto'; END IF;
 IF _people IS NULL OR _people<1 THEN RAISE EXCEPTION 'Inserisci almeno una persona'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,0));
 SELECT settings INTO cfg FROM public.restaurants WHERE id=rid;
 local_now := now() AT TIME ZONE 'Europe/Rome';
 rounded := date_trunc('hour',local_now) + round(extract(minute FROM local_now)/5.0)*interval '5 minutes';
 hh := to_char(rounded,'HH24:MI');
 SELECT sh INTO s FROM unnest(ARRAY['colazione','pranzo','sera']) sh WHERE coalesce((cfg->'shifts'->sh->>'enabled')::boolean, sh<>'colazione') AND hh BETWEEN coalesce(cfg->'shifts'->sh->>'from',CASE sh WHEN 'colazione' THEN '07:30' WHEN 'pranzo' THEN '12:00' ELSE '19:00' END) AND coalesce(cfg->'shifts'->sh->>'to',CASE sh WHEN 'colazione' THEN '10:30' WHEN 'pranzo' THEN '14:30' ELSE '23:00' END) LIMIT 1;
 IF s IS NULL THEN s := CASE WHEN hh>='16:00' THEN 'sera' ELSE 'pranzo' END; END IF;
 IF NOT coalesce((cfg->'shifts'->s->>'enabled')::boolean,s<>'colazione') THEN RAISE EXCEPTION 'Turno non attivo'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(cfg->'holidays','[]'::jsonb)) h WHERE rounded::date BETWEEN (h->>'from')::date AND (h->>'to')::date) OR coalesce(cfg->'weekly'->(extract(dow FROM rounded)::integer::text),'[]'::jsonb) ? s THEN RAISE EXCEPTION 'Servizio chiuso'; END IF;
 SELECT ro.* INTO room FROM public.rooms ro JOIN public.restaurant_tables t ON t.room_id=ro.id WHERE t.id=_table AND t.restaurant_id=rid AND ro.restaurant_id=rid AND t.seats>=_people;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tavolo non disponibile per questi coperti'; END IF;
 IF s=ANY(coalesce(room.closed_shifts,'{}'::text[])) OR (room.open_days IS NOT NULL AND NOT extract(dow FROM rounded)::integer=ANY(room.open_days)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(room.closed_periods,'[]'::jsonb)) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN to_char(rounded,'MM-DD') BETWEEN p->>'from' AND p->>'to' ELSE to_char(rounded,'MM-DD')>=p->>'from' OR to_char(rounded,'MM-DD')<=p->>'to' END) THEN RAISE EXCEPTION 'Sala chiusa'; END IF;
 IF EXISTS(SELECT 1 FROM public.reservations o WHERE o.restaurant_id=rid AND o.date=rounded::date AND o.shift=s AND o.deleted_at IS NULL AND NOT o.no_show AND _table=ANY(o.table_ids) AND (o.time='' OR (extract(hour FROM rounded)*60+extract(minute FROM rounded) < CASE WHEN coalesce(o.duration_min,(cfg->>'duration')::integer,90)<0 THEN 1440 ELSE split_part(o.time,':',1)::integer*60+split_part(o.time,':',2)::integer+coalesce(o.duration_min,(cfg->>'duration')::integer,90)+coalesce(o.buffer_min,(cfg->>'buffer')::integer,15) END AND split_part(o.time,':',1)::integer*60+split_part(o.time,':',2)::integer < extract(hour FROM rounded)*60+extract(minute FROM rounded)+105))) THEN RAISE EXCEPTION 'Il tavolo è stato occupato: scegli un altro tavolo'; END IF;
 INSERT INTO public.reservations(restaurant_id,date,shift,time,name,people,table_ids,arrived,duration_min,buffer_min,customer_id,phone,is_new,outside) VALUES(rid,rounded::date,s,hh,coalesce(nullif(trim(_name),''),'Passante'),_people,ARRAY[_table],true,90,15,NULL,NULL,false,room.environment='esterno') RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_service_walkin(integer,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_service_walkin(integer,uuid,text) TO authenticated;