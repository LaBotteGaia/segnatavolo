DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.get_online_booking_page(text)'::regprocedure) INTO def;
 def:=replace(def,'''enable_double_shift'',r.enable_double_shift','''enable_double_shift'',CASE WHEN r.online_turns_override THEN r.enable_double_shift ELSE EXISTS(SELECT 1 FROM public.rooms rm CROSS JOIN LATERAL jsonb_array_elements(rm.double_shifts) ds WHERE rm.restaurant_id=r.id) END');
 def:=replace(def,'''double_shift_days'',r.double_shift_days','''double_shift_days'',CASE WHEN r.online_turns_override THEN to_jsonb(r.double_shift_days) ELSE ''[]''::jsonb END');
 def:=replace(def,'''first_shift_duration_minutes'',r.first_shift_duration_minutes','''first_shift_duration_minutes'',CASE WHEN r.online_turns_override THEN r.first_shift_duration_minutes ELSE coalesce((r.settings->>''duration'')::int,90) END'); EXECUTE def;
 SELECT pg_get_functiondef('public.decide_online_booking(uuid,uuid,boolean,uuid[],jsonb,text)'::regprocedure) INTO def;
 def:=replace(def,'IF _accept THEN PERFORM public.validate_online_assignment','IF _accept THEN UPDATE public.reservations SET duration_min=public.online_booking_duration(_restaurant_id,r.date,r.shift,r.time) WHERE id=r.id; SELECT * INTO r FROM public.reservations WHERE id=r.id; PERFORM public.validate_online_assignment'); EXECUTE def;
END $$;