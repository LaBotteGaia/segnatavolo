ALTER TABLE public.restaurants ADD COLUMN notify_restaurant_on_confirmation boolean NOT NULL DEFAULT false, ADD COLUMN online_turns_override boolean NOT NULL DEFAULT false, ADD COLUMN schedule_exceptions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.reservations ADD COLUMN modification_status text NOT NULL DEFAULT 'none' CHECK(modification_status IN ('none','pending_modification','accepted','rejected')), ADD COLUMN modification_reason text NOT NULL DEFAULT '';
CREATE INDEX reservations_pending_modification ON public.reservations(restaurant_id,date) WHERE modification_status='pending_modification' AND deleted_at IS NULL;
CREATE OR REPLACE FUNCTION public.validate_schedule_exceptions() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE e jsonb; sh text; v jsonb; BEGIN
 IF jsonb_typeof(NEW.schedule_exceptions)<>'array' OR jsonb_array_length(NEW.schedule_exceptions)>100 THEN RAISE EXCEPTION 'Massimo 100 eccezioni di calendario'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(NEW.schedule_exceptions) LOOP
 IF e->>'id' IS NULL OR (e->>'id')::uuid IS NULL OR e->>'exception_type' NOT IN ('chiusura_straordinaria','apertura_straordinaria') OR e->>'applies_to' NOT IN ('tutto_il_giorno','solo_pranzo','solo_cena') OR e->>'start_date' IS NULL OR e->>'end_date' IS NULL OR (e->>'start_date')::date>(e->>'end_date')::date OR length(coalesce(e->>'reason',''))>500 OR NOT e ? 'exception_type' OR NOT e ? 'applies_to' THEN RAISE EXCEPTION 'Eccezione di calendario non valida'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.schedule_exceptions))<>jsonb_array_length(NEW.schedule_exceptions) THEN RAISE EXCEPTION 'Eccezione duplicata'; END IF;
 IF NEW.online_turns_override THEN
 FOREACH sh IN ARRAY ARRAY['pranzo','sera'] LOOP v:=NEW.online_config->'shifts'->sh; IF v IS NOT NULL AND (coalesce(v->>'from','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(v->>'to','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR v->>'from'>=v->>'to') THEN RAISE EXCEPTION 'Orari online non validi'; END IF; END LOOP;
 END IF;
 NEW.settings:=jsonb_set(NEW.settings,'{schedule_exceptions}',NEW.schedule_exceptions); RETURN NEW;
 END $$;
CREATE TRIGGER zz_validate_schedule_exceptions BEFORE INSERT OR UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_exceptions();
CREATE OR REPLACE FUNCTION public.schedule_exception_state(_rid uuid,_date date,_shift text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN bool_or(e->>'exception_type'='chiusura_straordinaria') THEN -1 WHEN count(*)>0 THEN 1 ELSE 0 END FROM public.restaurants r CROSS JOIN LATERAL jsonb_array_elements(r.schedule_exceptions) e WHERE r.id=_rid AND _date BETWEEN (e->>'start_date')::date AND (e->>'end_date')::date AND (e->>'applies_to'='tutto_il_giorno' OR e->>'applies_to'=CASE _shift WHEN 'pranzo' THEN 'solo_pranzo' WHEN 'sera' THEN 'solo_cena' ELSE '' END) $$;
REVOKE ALL ON FUNCTION public.schedule_exception_state(uuid,date,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.schedule_exception_state(uuid,date,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.online_service_open(_rid uuid,_date date,_shift text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE st jsonb; state int; BEGIN
 state:=public.schedule_exception_state(_rid,_date,_shift); IF state=-1 THEN RETURN false; ELSIF state=1 THEN RETURN true; END IF;
 SELECT settings INTO st FROM public.restaurants WHERE id=_rid;
 RETURN st IS NOT NULL AND NOT(coalesce(st->'weekly'->extract(dow FROM _date)::int::text,'[]'::jsonb) ? _shift OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(st->'holidays','[]')) h WHERE _date::text BETWEEN h->>'from' AND h->>'to')); END $$;
REVOKE ALL ON FUNCTION public.online_service_open(uuid,date,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.online_service_open(uuid,date,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.room_service_open(_room public.rooms,_date date,_shift text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.schedule_exception_state(_room.restaurant_id,_date,_shift)<>-1 AND (extract(dow FROM _date)::int=ANY(_room.open_days) OR public.schedule_exception_state(_room.restaurant_id,_date,_shift)=1) AND NOT(_shift=ANY(_room.closed_shifts) OR public.room_weather_closed(_room,_date,_shift)) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_room.closed_periods) p WHERE CASE WHEN p->>'from'<=p->>'to' THEN to_char(_date,'MM-DD') BETWEEN p->>'from' AND p->>'to' ELSE to_char(_date,'MM-DD')>=p->>'from' OR to_char(_date,'MM-DD')<=p->>'to' END) $$;
REVOKE ALL ON FUNCTION public.room_service_open(public.rooms,date,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.room_service_open(public.rooms,date,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.online_effective_settings(_rid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN online_turns_override THEN jsonb_set(r.settings,'{shifts}',coalesce(r.settings->'shifts','{}')||coalesce(r.online_config->'shifts','{}')) ELSE r.settings END FROM public.restaurants r WHERE id=_rid $$;
REVOKE ALL ON FUNCTION public.online_effective_settings(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.online_effective_settings(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.online_effective_config(_rid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE v public.restaurants; cfg jsonb; windows jsonb:='{}'; sh text; start_tm time; dur int; buf int; BEGIN
 SELECT * INTO v FROM public.restaurants WHERE id=_rid; IF NOT FOUND THEN RETURN '{}'; END IF; IF v.online_turns_override THEN RETURN v.online_config; END IF;
 dur:=greatest(0,coalesce((v.settings->>'duration')::int,90)); buf:=coalesce((v.settings->>'buffer')::int,15);
 FOREACH sh IN ARRAY ARRAY['pranzo','sera'] LOOP start_tm:=coalesce(v.settings->'shifts'->sh->>'from',CASE sh WHEN 'pranzo' THEN '12:00' ELSE '19:00' END)::time; windows:=windows||jsonb_build_object(sh,jsonb_build_object('first_to',to_char(start_tm,'HH24:MI'),'second_from',to_char(start_tm+make_interval(mins=>ceil((dur+buf)/15.0)::int*15),'HH24:MI'))); END LOOP;
 RETURN jsonb_set(v.online_config,'{double_windows}',windows); END $$;
REVOKE ALL ON FUNCTION public.online_effective_config(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.online_effective_config(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.restaurant_web_double_day(_rid uuid,_date date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT online_turns_override AND enable_double_shift AND (ARRAY['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'])[extract(dow FROM _date)::int+1]=ANY(double_shift_days) FROM public.restaurants WHERE id=_rid),false) $$;
CREATE OR REPLACE FUNCTION public.online_booking_duration(_rid uuid,_date date,_shift text,_time text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE public.online_slot_turn(_rid,_date,_shift,_time) WHEN 2 THEN -1 WHEN 1 THEN CASE WHEN r.online_turns_override THEN r.first_shift_duration_minutes ELSE coalesce((r.settings->>'duration')::int,90) END ELSE coalesce((r.settings->>'duration')::int,90) END FROM public.restaurants r WHERE r.id=_rid $$;
REVOKE ALL ON FUNCTION public.online_booking_duration(uuid,date,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.online_booking_duration(uuid,date,text,text) TO authenticated,service_role;
DO $$ DECLARE def text; fn text; old text; BEGIN
 FOREACH fn IN ARRAY ARRAY['public.online_slot_remaining(uuid,date,text,text,uuid)','public.online_shift_remaining(uuid,date,text)'] LOOP
 SELECT pg_get_functiondef(fn::regprocedure) INTO def;
 def:=replace(def,'SELECT settings,online_config,timezone,','SELECT public.online_effective_settings(id),public.online_effective_config(id),timezone,');
 old:='coalesce(st->''weekly''->dow::text,''[]''::jsonb) ? _shift OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(st->''holidays'',''[]'')) h WHERE _date::text BETWEEN h->>''from'' AND h->>''to'')'; IF position(old IN def)=0 THEN RAISE EXCEPTION 'Contratto calendario cambiato: %',fn; END IF; def:=replace(def,old,'NOT public.online_service_open(_rid,_date,_shift)');
 old:='NOT dow=ANY(r.open_days) OR (_shift=ANY(r.closed_shifts) OR public.room_weather_closed(r,_date,_shift)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.closed_periods) p WHERE CASE WHEN p->>''from''<=p->>''to'' THEN md BETWEEN p->>''from'' AND p->>''to'' ELSE md>=p->>''from'' OR md<=p->>''to'' END)'; IF position(old IN def)=0 THEN RAISE EXCEPTION 'Contratto sala cambiato: %',fn; END IF; def:=replace(def,old,'NOT public.room_service_open(r,_date,_shift)');
 IF fn LIKE '%online_slot_remaining%' THEN
 old:='dur:=CASE WHEN public.restaurant_web_double_day(_rid,_date) AND public.online_slot_turn(_rid,_date,_shift,_time)=1 THEN (SELECT first_shift_duration_minutes FROM public.restaurants WHERE id=_rid) WHEN public.restaurant_web_double_day(_rid,_date) AND public.online_slot_turn(_rid,_date,_shift,_time)=2 THEN -1 ELSE coalesce((st->>''duration'')::int,90) END;'; IF position(old IN def)=0 THEN RAISE EXCEPTION 'Contratto durata cambiato'; END IF; def:=replace(def,old,'dur:=public.online_booking_duration(_rid,_date,_shift,_time);');
 END IF; EXECUTE def; END LOOP;
 SELECT pg_get_functiondef('public.online_slot_turn(uuid,date,text,text)'::regprocedure) INTO def;
 def:=replace(def,'SELECT settings,online_config INTO st,cfg','SELECT public.online_effective_settings(id),public.online_effective_config(id) INTO st,cfg');
 def:=replace(def,'dow=ANY(r.open_days) AND NOT((_shift=ANY(r.closed_shifts) OR public.room_weather_closed(r,_date,_shift))) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.closed_periods) p WHERE CASE WHEN p->>''from''<=p->>''to'' THEN md BETWEEN p->>''from'' AND p->>''to'' ELSE md>=p->>''from'' OR md<=p->>''to'' END)','public.room_service_open(r,_date,_shift)');
 def:=replace(def,'doubled:=doubled OR public.restaurant_web_double_day(_rid,_date);','IF (SELECT online_turns_override FROM public.restaurants WHERE id=_rid) THEN doubled:=public.restaurant_web_double_day(_rid,_date); END IF;');
 def:=replace(def,'dur:=CASE WHEN public.restaurant_web_double_day(_rid,_date) THEN (SELECT first_shift_duration_minutes FROM public.restaurants WHERE id=_rid) ELSE coalesce((st->>''duration'')::int,90) END;','dur:=CASE WHEN (SELECT online_turns_override FROM public.restaurants WHERE id=_rid) THEN (SELECT first_shift_duration_minutes FROM public.restaurants WHERE id=_rid) ELSE coalesce((st->>''duration'')::int,90) END;'); EXECUTE def;
 SELECT pg_get_functiondef('public.get_online_booking_slots(text,date,text)'::regprocedure) INTO def; def:=replace(def,'r.settings->''shifts''','public.online_effective_settings(r.id)->''shifts'''); EXECUTE def;
 SELECT pg_get_functiondef('public.submit_online_booking_original(text,jsonb)'::regprocedure) INTO def; def:=replace(def,'restaurants.settings,online_config','public.online_effective_settings(restaurants.id),public.online_effective_config(restaurants.id)'); EXECUTE def;
 SELECT pg_get_functiondef('public.submit_online_booking(text,jsonb)'::regprocedure) INTO def;
 old:='duration_min=CASE WHEN public.restaurant_web_double_day(rid,(_data->>''date'')::date) AND public.online_slot_turn(rid,(_data->>''date'')::date,_data->>''shift'',_data->>''time'')=1 THEN (SELECT first_shift_duration_minutes FROM public.restaurants WHERE id=rid) WHEN public.restaurant_web_double_day(rid,(_data->>''date'')::date) AND public.online_slot_turn(rid,(_data->>''date'')::date,_data->>''shift'',_data->>''time'')=2 THEN -1 ELSE duration_min END'; IF position(old IN def)=0 THEN RAISE EXCEPTION 'Contratto invio cambiato'; END IF; def:=replace(def,old,'duration_min=public.online_booking_duration(rid,(_data->>''date'')::date,_data->>''shift'',_data->>''time'')'); EXECUTE def;
 SELECT pg_get_functiondef('public.validate_online_assignment(uuid,uuid,uuid[],jsonb)'::regprocedure) INTO def;
 def:=replace(def,'NOT dow=ANY(room.open_days) OR (r.shift=ANY(room.closed_shifts) OR public.room_weather_closed(room,r.date,r.shift)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(room.closed_periods) p WHERE CASE WHEN p->>''from''<=p->>''to'' THEN md BETWEEN p->>''from'' AND p->>''to'' ELSE md>=p->>''from'' OR md<=p->>''to'' END)','NOT public.room_service_open(room,r.date,r.shift)'); EXECUTE def;
 SELECT pg_get_functiondef('public.decide_online_booking(uuid,uuid,boolean,uuid[],jsonb,text)'::regprocedure) INTO def;
 def:=replace(def,'NOT extract(dow FROM r.date)::int=ANY(room.open_days) OR (r.shift=ANY(room.closed_shifts) OR public.room_weather_closed(room,r.date,r.shift)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(room.closed_periods) p WHERE CASE WHEN p->>''from''<=p->>''to'' THEN to_char(r.date,''MM-DD'') BETWEEN p->>''from'' AND p->>''to'' ELSE to_char(r.date,''MM-DD'')>=p->>''from'' OR to_char(r.date,''MM-DD'')<=p->>''to'' END)','NOT public.room_service_open(room,r.date,r.shift)');
 def:=replace(def,'IF _accept THEN PERFORM public.validate_online_assignment','IF _accept AND NOT public.online_service_open(_restaurant_id,r.date,r.shift) THEN RAISE EXCEPTION ''Servizio chiuso per questa data''; END IF; IF _accept THEN PERFORM public.validate_online_assignment'); EXECUTE def;
END $$;
CREATE OR REPLACE FUNCTION public.validate_online_double_windows() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE sh text; w jsonb; first_to text; second_from text; dur int; buf int; BEGIN
 IF NOT NEW.online_turns_override OR NOT NEW.enable_double_shift THEN RETURN NEW; END IF;
 dur:=NEW.first_shift_duration_minutes; buf:=coalesce((NEW.settings->>'buffer')::int,15);
 FOREACH sh IN ARRAY ARRAY['pranzo','sera'] LOOP w:=NEW.online_config->'double_windows'->sh; IF w IS NULL THEN CONTINUE; END IF; first_to:=w->>'first_to'; second_from:=w->>'second_from';
 IF first_to IS NULL OR second_from IS NULL OR first_to !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR second_from !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR first_to>=second_from OR split_part(first_to,':',2)::int%15<>0 OR split_part(second_from,':',2)::int%15<>0 OR split_part(first_to,':',1)::int*60+split_part(first_to,':',2)::int+dur+buf>split_part(second_from,':',1)::int*60+split_part(second_from,':',2)::int THEN RAISE EXCEPTION 'Lascia durata tavolo e margine pulizia tra i due turni'; END IF; END LOOP; RETURN NEW; END $$;
CREATE TRIGGER validate_online_override_windows BEFORE UPDATE OF online_turns_override,enable_double_shift,first_shift_duration_minutes,settings ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.validate_online_double_windows();
DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.get_online_booking_page(text)'::regprocedure) INTO def;
 def:=replace(def,'''config'',r.online_config','''config'',public.online_effective_config(r.id),''schedule_exceptions'',r.schedule_exceptions');
 def:=replace(def,'r.settings->''shifts''','public.online_effective_settings(r.id)->''shifts'''); EXECUTE def; END $$;
CREATE OR REPLACE FUNCTION public.manage_customer_booking(_token uuid,_action text,_time text DEFAULT NULL,_people integer DEFAULT NULL,_date date DEFAULT NULL,_shift text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.reservations; v public.restaurants; eid uuid; msg text; req jsonb; dt date; sh text; rem int; result jsonb; BEGIN
 IF _action NOT IN ('view','confirm','cancel','request_change') OR _token IS NULL THEN RAISE EXCEPTION 'Link non valido'; END IF;
 SELECT * INTO r FROM public.reservations WHERE management_token=_token AND channel='online'; IF NOT FOUND THEN RAISE EXCEPTION 'Link non valido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.restaurant_id::text,0)); SELECT * INTO r FROM public.reservations WHERE id=r.id FOR UPDATE; SELECT * INTO v FROM public.restaurants WHERE id=r.restaurant_id;
 IF r.date<(now() AT TIME ZONE v.timezone)::date OR r.status<>'confirmed' OR r.arrived OR (r.deleted_at IS NOT NULL AND r.confirmation_status NOT LIKE 'cancellata%') THEN RAISE EXCEPTION 'Link non più disponibile'; END IF;
 IF r.deleted_at IS NULL THEN
 IF _action='confirm' THEN UPDATE public.reservations SET confirmation_status='riconfermata' WHERE id=r.id; r.confirmation_status:='riconfermata';
 ELSIF _action='cancel' THEN UPDATE public.reservations SET confirmation_status='cancellata_cliente',cancellation_reason='Disdetta del cliente',deleted_at=now(),table_ids='{}',customer_change_request=NULL,modification_status='none' WHERE id=r.id; r.confirmation_status:='cancellata_cliente'; r.customer_change_request:=NULL; msg:='Il cliente '||r.name||' ha cancellato la prenotazione per il '||to_char(r.date,'DD/MM/YYYY')||' alle '||r.time||'. Tavolo liberato.';
 ELSIF _action='request_change' THEN
 dt:=coalesce(_date,r.date); sh:=coalesce(_shift,r.shift);
 IF _time IS NULL OR _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR _people IS NULL OR _people NOT BETWEEN 1 AND coalesce((v.online_config->>'max_party_size')::int,6) OR sh NOT IN ('pranzo','sera') OR public.online_slot_turn(v.id,dt,sh,_time) IS NULL THEN RAISE EXCEPTION 'Scegli un orario autorizzato e coperti entro il limite online'; END IF;
 rem:=public.online_slot_remaining(v.id,dt,sh,_time,r.id); IF rem IS NULL OR rem<_people THEN RAISE EXCEPTION 'La nuova data o fascia oraria non è disponibile'; END IF;
 req:=jsonb_build_object('date',dt,'shift',sh,'time',_time,'people',_people);
 IF dt=r.date AND sh=r.shift AND _time=r.time AND _people=r.people THEN RAISE EXCEPTION 'Non hai modificato la prenotazione'; END IF;
 IF r.customer_change_request IS DISTINCT FROM req OR r.modification_status<>'pending_modification' THEN
 PERFORM set_config('segnatavolo.customer_change','on',true); UPDATE public.reservations SET customer_change_request=req,modification_status='pending_modification',modification_reason='' WHERE id=r.id; PERFORM set_config('segnatavolo.customer_change','off',true); r.customer_change_request:=req; r.modification_status:='pending_modification';
 msg:='Richiesta Modifica Cliente: '||r.name||'. Attuale: '||to_char(r.date,'DD/MM/YYYY')||' '||r.time||', '||r.people||' coperti. Richiesta: '||to_char(dt,'DD/MM/YYYY')||' '||_time||', '||_people||' coperti. Prenotazione originale valida.'; END IF;
 END IF;
 IF msg IS NOT NULL THEN INSERT INTO public.service_notifications(restaurant_id,reservation_id,kind,message,details) VALUES(r.restaurant_id,r.id,CASE WHEN _action='cancel' THEN 'cancelled' ELSE 'change_requested' END,msg,jsonb_build_object('old_date',r.date,'old_shift',r.shift,'old_time',r.time,'old_people',r.people,'requested',r.customer_change_request)) RETURNING id INTO eid; END IF;
 END IF;
 RETURN jsonb_build_object('restaurant',v.name,'date',r.date,'time',r.time,'shift',r.shift,'people',r.people,'confirmation_status',r.confirmation_status,'change_request',r.customer_change_request,'modification_status',r.modification_status,'modification_reason',r.modification_reason,'event_id',eid,'restaurant_id',r.restaurant_id,'slug',CASE WHEN v.online_enabled THEN v.web_slug ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.manage_customer_booking(uuid,text,text,integer,date,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.manage_customer_booking(uuid,text,text,integer,date,text) TO service_role;
-- Keep the legacy signature for callers deployed before this release, without ambiguous default overloads.
CREATE OR REPLACE FUNCTION public.manage_customer_booking(_token uuid,_action text,_time text DEFAULT NULL,_people integer DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.manage_customer_booking(_token,_action,_time,_people,NULL::date,NULL::text) $$;
CREATE OR REPLACE FUNCTION public.decide_customer_change(_rid uuid,_id uuid,_accept boolean,_expected jsonb,_tables uuid[] DEFAULT '{}',_extras jsonb DEFAULT '{}',_reason text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.reservations; req jsonb; dt date; sh text; tm text; pax int; rem int; result jsonb; BEGIN
 IF auth.uid() IS NULL OR NOT public.can_use_restaurant(_rid) OR _accept IS NULL THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_rid::text,0)); SELECT * INTO r FROM public.reservations WHERE restaurant_id=_rid AND id=_id AND channel='online' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR r.status<>'confirmed' OR r.arrived OR r.tavolo_bloccato OR r.modification_status<>'pending_modification' OR r.customer_change_request IS NULL OR r.customer_change_request IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'Richiesta cambiata, già gestita o prenotazione bloccata: aggiorna l’agenda'; END IF;
 req:=r.customer_change_request;
 IF NOT _accept AND length(trim(_reason)) NOT BETWEEN 2 AND 1000 THEN RAISE EXCEPTION 'Inserisci una motivazione'; END IF;
 IF _accept THEN
 dt:=coalesce((req->>'date')::date,r.date); sh:=coalesce(req->>'shift',r.shift); tm:=req->>'time'; pax:=(req->>'people')::int;
 IF public.online_slot_turn(_rid,dt,sh,tm) IS NULL THEN RAISE EXCEPTION 'Orario non più disponibile'; END IF;
 rem:=public.online_slot_remaining(_rid,dt,sh,tm,r.id); IF rem IS NULL OR rem<pax THEN RAISE EXCEPTION 'Capienza non più disponibile'; END IF;
 PERFORM set_config('segnatavolo.online_decision','on',true); PERFORM set_config('segnatavolo.customer_change','on',true);
 UPDATE public.reservations SET date=dt,shift=sh,time=tm,people=pax,duration_min=public.online_booking_duration(_rid,dt,sh,tm),buffer_min=(SELECT coalesce((settings->>'buffer')::int,15) FROM public.restaurants WHERE id=_rid),status='pending',table_ids='{}' WHERE id=r.id;
 result:=public.decide_online_booking(_rid,_id,true,_tables,_extras,'');
 UPDATE public.reservations SET modification_status='accepted',customer_change_request=NULL,modification_reason='',confirmation_status='in_attesa_riconferma',delay_notified=false WHERE id=r.id;
 ELSE
 PERFORM set_config('segnatavolo.customer_change','on',true); UPDATE public.reservations SET modification_status='rejected',customer_change_request=NULL,modification_reason=trim(_reason) WHERE id=r.id;
 END IF;
 PERFORM set_config('segnatavolo.customer_change','off',true); PERFORM set_config('segnatavolo.online_decision','off',true);
 RETURN jsonb_build_object('id',r.id,'accepted',_accept,'request',req,'reason',CASE WHEN _accept THEN '' ELSE trim(_reason) END);
END $$;
REVOKE ALL ON FUNCTION public.decide_customer_change(uuid,uuid,boolean,jsonb,uuid[],jsonb,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.decide_customer_change(uuid,uuid,boolean,jsonb,uuid[],jsonb,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_customer_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND current_setting('segnatavolo.customer_change',true) IS DISTINCT FROM 'on' THEN
 IF NEW.customer_change_request IS DISTINCT FROM OLD.customer_change_request OR NEW.modification_status IS DISTINCT FROM OLD.modification_status OR NEW.modification_reason IS DISTINCT FROM OLD.modification_reason THEN RAISE EXCEPTION 'Usa i comandi di approvazione della modifica cliente'; END IF;
 IF OLD.modification_status='pending_modification' AND (NEW.date IS DISTINCT FROM OLD.date OR NEW.time IS DISTINCT FROM OLD.time OR NEW.shift IS DISTINCT FROM OLD.shift OR NEW.people IS DISTINCT FROM OLD.people) THEN RAISE EXCEPTION 'Prima gestisci la richiesta di modifica cliente'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_customer_change BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_customer_change();