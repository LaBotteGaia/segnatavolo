CREATE OR REPLACE FUNCTION public.audit_reservation_operator()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE operator_name text;
BEGIN
 -- Ripristino da backup (solo Super Admin, dentro restore_restaurant_data): conserva l'audit originale.
 IF current_setting('segnatavolo.restore', true) = 'on' AND public.is_super_admin() THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN
  SELECT name INTO operator_name FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id = NEW.restaurant_id AND status = 'active';
  IF operator_name IS NULL OR length(trim(operator_name)) = 0 THEN RAISE EXCEPTION 'Inserisci il tuo nome o nickname di sala prima di salvare'; END IF;
 ELSE operator_name := 'Sistema'; END IF;
 IF TG_OP = 'INSERT' THEN
  NEW.created_by := auth.uid(); NEW.created_by_name := trim(operator_name); NEW.created_at := now(); NEW.updated_by_name := NULL; NEW.updated_at := NULL;
 ELSE
  NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name; NEW.created_at := OLD.created_at;
  NEW.updated_by_name := trim(operator_name); NEW.updated_at := now();
 END IF;
 RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.delete_restaurant_cascade(_restaurant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 DELETE FROM service_notes WHERE restaurant_id=_restaurant_id;
 DELETE FROM reservations WHERE restaurant_id=_restaurant_id;
 DELETE FROM customers WHERE restaurant_id=_restaurant_id;
 DELETE FROM restaurant_tables WHERE restaurant_id=_restaurant_id;
 DELETE FROM rooms WHERE restaurant_id=_restaurant_id;
 DELETE FROM restaurant_invites WHERE restaurant_id=_restaurant_id;
 DELETE FROM restaurant_members WHERE restaurant_id=_restaurant_id;
 DELETE FROM restaurants WHERE id=_restaurant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ristorante non trovato'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delete_restaurant_user(_user_id uuid, _restaurant_id uuid, _delete_from_auth boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $$
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Non puoi eliminare il tuo account dal pannello'; END IF;
 DELETE FROM public.restaurant_members WHERE user_id=_user_id AND restaurant_id=_restaurant_id;
 IF _delete_from_auth THEN
  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE id=_user_id) THEN RAISE EXCEPTION 'Non puoi eliminare un Super Admin'; END IF;
  DELETE FROM public.restaurant_members WHERE user_id=_user_id;
  DELETE FROM auth.users WHERE id=_user_id;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.export_restaurant_data(_restaurant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE res jsonb;
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id=_restaurant_id) THEN RAISE EXCEPTION 'Ristorante non trovato'; END IF;
 SELECT jsonb_build_object(
  'meta', jsonb_build_object('format','segnatavolo-backup','schema_version',1,
     'exported_at', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     'source_restaurant_id', _restaurant_id),
  'restaurant', (SELECT jsonb_build_object('id',id,'name',name,'created_at',created_at,'settings',settings) FROM restaurants WHERE id=_restaurant_id),
  'rooms', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sort_order, x.created_at) FROM rooms x WHERE x.restaurant_id=_restaurant_id),'[]'),
  'tables', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM restaurant_tables x WHERE x.restaurant_id=_restaurant_id),'[]'),
  'customers', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM customers x WHERE x.restaurant_id=_restaurant_id),'[]'),
  'reservations', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.date, x.time) FROM reservations x WHERE x.restaurant_id=_restaurant_id),'[]'),
  'service_notes', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM service_notes x WHERE x.restaurant_id=_restaurant_id),'[]')
 ) INTO res;
 RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.restore_restaurant_data(_target_restaurant_id uuid, _backup_data jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE b jsonb := _backup_data; t uuid := _target_restaurant_id;
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id=t) THEN RAISE EXCEPTION 'Ristorante non trovato'; END IF;
 IF b IS NULL OR jsonb_typeof(b)<>'object' OR jsonb_typeof(b->'rooms') IS DISTINCT FROM 'array'
    OR jsonb_typeof(b->'tables') IS DISTINCT FROM 'array' OR jsonb_typeof(b->'reservations') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'File di backup non conforme';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text,0));
 PERFORM set_config('segnatavolo.restore','on',true);

 DELETE FROM service_notes WHERE restaurant_id=t;
 DELETE FROM reservations WHERE restaurant_id=t;
 DELETE FROM customers WHERE restaurant_id=t;
 DELETE FROM restaurant_tables WHERE restaurant_id=t;
 DELETE FROM rooms WHERE restaurant_id=t;

 DROP TABLE IF EXISTS pg_temp._rmap;
 CREATE TEMP TABLE _rmap(old uuid PRIMARY KEY, new uuid NOT NULL DEFAULT gen_random_uuid()) ON COMMIT DROP;
 INSERT INTO _rmap(old)
  SELECT DISTINCT (x->>'id')::uuid FROM (
   SELECT jsonb_array_elements(b->'rooms') x UNION ALL SELECT jsonb_array_elements(b->'tables')
   UNION ALL SELECT jsonb_array_elements(coalesce(b->'customers','[]'))
   UNION ALL SELECT jsonb_array_elements(b->'reservations')
   UNION ALL SELECT jsonb_array_elements(coalesce(b->'service_notes','[]'))) s
  WHERE x->>'id' IS NOT NULL;

 INSERT INTO rooms(id,name,sort_order,created_at,restaurant_id,environment,capacity,walls,grid_cols,grid_rows,locked,open_days,closed_periods,closed_shifts,double_shifts)
 SELECT m.new, p.name, coalesce(p.sort_order,0), coalesce(p.created_at,now()), t, coalesce(p.environment,'interno'), p.capacity,
   coalesce(p.walls,'[]'), coalesce(p.grid_cols,6), coalesce(p.grid_rows,5), coalesce(p.locked,true),
   coalesce(p.open_days,'{0,1,2,3,4,5,6}'), coalesce(p.closed_periods,'[]'), coalesce(p.closed_shifts,'{}'), coalesce(p.double_shifts,'[]')
 FROM jsonb_array_elements(b->'rooms') x CROSS JOIN LATERAL jsonb_populate_record(NULL::public.rooms, x) p JOIN _rmap m ON m.old=p.id;

 INSERT INTO restaurant_tables(id,room_id,name,seats,x,y,created_at,restaurant_id,allow_extras,no_join)
 SELECT m.new, rm.new, p.name, coalesce(p.seats,4), coalesce(p.x,0), coalesce(p.y,0), coalesce(p.created_at,now()), t, coalesce(p.allow_extras,true),
   coalesce(ARRAY(SELECT m2.new FROM unnest(coalesce(p.no_join,'{}')) o JOIN _rmap m2 ON m2.old=o),'{}')
 FROM jsonb_array_elements(b->'tables') x CROSS JOIN LATERAL jsonb_populate_record(NULL::public.restaurant_tables, x) p
 JOIN _rmap m ON m.old=p.id JOIN _rmap rm ON rm.old=p.room_id;

 INSERT INTO customers(id,name,phone,notes,created_at,restaurant_id,first_name,last_name,extra_phones,emails)
 SELECT m.new, p.name, p.phone, p.notes, coalesce(p.created_at,now()), t, coalesce(p.first_name,''), coalesce(p.last_name,''),
   coalesce(p.extra_phones,'{}'), coalesce(p.emails,'{}')
 FROM jsonb_array_elements(coalesce(b->'customers','[]')) x CROSS JOIN LATERAL jsonb_populate_record(NULL::public.customers, x) p JOIN _rmap m ON m.old=p.id;

 INSERT INTO reservations(id,date,shift,time,name,phone,customer_id,people,table_ids,notes,outside,is_new,arrived,created_at,restaurant_id,created_by,
   extra_sponde,extra_barelle,barella_seats,duration_min,buffer_min,no_show,tags,created_by_name,updated_by_name,updated_at,deleted_at)
 SELECT m.new, p.date, p.shift, coalesce(p.time,''), coalesce(p.name,''), p.phone, cm.new, coalesce(p.people,2),
   coalesce(ARRAY(SELECT m2.new FROM unnest(coalesce(p.table_ids,'{}')) o JOIN _rmap m2 ON m2.old=o),'{}'),
   coalesce(p.notes,''), coalesce(p.outside,false), coalesce(p.is_new,false), coalesce(p.arrived,false), coalesce(p.created_at,now()), t, p.created_by,
   coalesce(p.extra_sponde,0), coalesce(p.extra_barelle,0), coalesce(p.barella_seats,2), p.duration_min, p.buffer_min, coalesce(p.no_show,false),
   coalesce(p.tags,'{}'), coalesce(p.created_by_name,''), p.updated_by_name, p.updated_at, p.deleted_at
 FROM jsonb_array_elements(b->'reservations') x CROSS JOIN LATERAL jsonb_populate_record(NULL::public.reservations, x) p
 JOIN _rmap m ON m.old=p.id LEFT JOIN _rmap cm ON cm.old=p.customer_id;

 INSERT INTO service_notes(id,restaurant_id,date,shift,body,updated_at)
 SELECT m.new, t, p.date, p.shift, coalesce(p.body,''), coalesce(p.updated_at,now())
 FROM jsonb_array_elements(coalesce(b->'service_notes','[]')) x CROSS JOIN LATERAL jsonb_populate_record(NULL::public.service_notes, x) p JOIN _rmap m ON m.old=p.id;

 IF jsonb_typeof(b->'restaurant'->'settings')='object' THEN
  UPDATE restaurants SET settings=b->'restaurant'->'settings' WHERE id=t;
 END IF;
 PERFORM set_config('segnatavolo.restore','off',true);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.create_restaurant_from_backup(_name text, _backup_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE rid uuid; n text;
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 n := nullif(trim(coalesce(_name, _backup_data->'restaurant'->>'name','')),'');
 IF n IS NULL THEN RAISE EXCEPTION 'Inserisci un nome per il ristorante'; END IF;
 INSERT INTO restaurants(name) VALUES (n) RETURNING id INTO rid;
 PERFORM public.restore_restaurant_data(rid, _backup_data);
 RETURN rid;
END $$;

REVOKE ALL ON FUNCTION public.delete_restaurant_cascade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_restaurant_user(uuid,uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.export_restaurant_data(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_restaurant_data(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_restaurant_from_backup(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_restaurant_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_restaurant_user(uuid,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_restaurant_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_restaurant_data(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_restaurant_from_backup(text,jsonb) TO authenticated;