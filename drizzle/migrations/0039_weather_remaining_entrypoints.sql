-- All service entrypoints share the same one-off closure predicate.
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.create_service_walkin(integer,uuid,text)'::regprocedure) INTO d;
 d:=replace(d,'s=ANY(coalesce(room.closed_shifts,''{}''::text[]))','(s=ANY(coalesce(room.closed_shifts,''{}''::text[])) OR public.room_weather_closed(room,rounded::date,s))'); EXECUTE d;
 SELECT pg_get_functiondef('public.online_slot_turn(uuid,date,text,text)'::regprocedure) INTO d;
 d:=replace(d,'_shift=ANY(r.closed_shifts)','(_shift=ANY(r.closed_shifts) OR public.room_weather_closed(r,_date,_shift))'); EXECUTE d;
END $$;