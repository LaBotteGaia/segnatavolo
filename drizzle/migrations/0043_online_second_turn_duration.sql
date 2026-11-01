DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.submit_online_booking(text,jsonb)'::regprocedure) INTO def;
 def:=replace(def,'ELSE duration_min END, status=''pending''','WHEN public.restaurant_web_double_day(rid,(_data->>''date'')::date) AND public.online_slot_turn(rid,(_data->>''date'')::date,_data->>''shift'',_data->>''time'')=2 THEN -1 ELSE duration_min END, status=''pending'''); EXECUTE def;
 SELECT pg_get_functiondef('public.online_slot_remaining(uuid,date,text,text,uuid)'::regprocedure) INTO def;
 def:=replace(def,'ELSE coalesce((st->>''duration'')::int,90) END; buf:=','WHEN public.restaurant_web_double_day(_rid,_date) AND public.online_slot_turn(_rid,_date,_shift,_time)=2 THEN -1 ELSE coalesce((st->>''duration'')::int,90) END; buf:='); EXECUTE def;
END $$;