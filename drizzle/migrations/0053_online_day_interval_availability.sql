CREATE OR REPLACE FUNCTION public.online_day_remaining(_rid uuid,_date date,_shift text) RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE ceiling int; best int:=NULL; value int; sh jsonb; tm timestamp; BEGIN
 ceiling:=public.online_shift_remaining(_rid,_date,_shift); IF ceiling IS NULL OR ceiling=0 THEN RETURN ceiling; END IF;
 sh:=public.online_effective_settings(_rid)->'shifts'->_shift;
 FOR tm IN SELECT generate_series(_date+coalesce(sh->>'from',CASE _shift WHEN 'pranzo' THEN '12:00' ELSE '19:00' END)::time,_date+coalesce(sh->>'to',CASE _shift WHEN 'pranzo' THEN '14:30' ELSE '23:00' END)::time,interval '15 minutes') LOOP
 IF public.online_slot_turn(_rid,_date,_shift,to_char(tm,'HH24:MI')) IS NULL THEN CONTINUE; END IF;
 value:=public.online_slot_remaining(_rid,_date,_shift,to_char(tm,'HH24:MI')); best:=greatest(best,value); IF best>=ceiling THEN RETURN best; END IF;
 END LOOP; RETURN best; END $$;
REVOKE ALL ON FUNCTION public.online_day_remaining(uuid,date,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.online_day_remaining(uuid,date,text) TO service_role;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.get_online_booking_page(text)'::regprocedure) INTO def; def:=replace(def,'public.online_shift_remaining(r.id,d::date,','public.online_day_remaining(r.id,d::date,'); EXECUTE def; END $$;