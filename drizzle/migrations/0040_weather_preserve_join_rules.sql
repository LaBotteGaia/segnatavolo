-- Preserve the existing canJoin semantics: diagonals and cross-room pairs remain valid unless explicitly forbidden; walls are checked for aligned pairs.
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.close_weather_service(uuid,date,text,jsonb,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'a.room_id<>b.room_id OR b.id=ANY(a.no_join)','b.id=ANY(a.no_join)');
 d:=replace(d,'IF a.y=b.y THEN','IF a.room_id=b.room_id AND a.y=b.y THEN');
 d:=replace(d,'ELSIF a.x=b.x THEN','ELSIF a.room_id=b.room_id AND a.x=b.x THEN');
 d:=replace(d,'ELSE RAISE EXCEPTION ''Tavoli non contigui''; END IF;','END IF;');
 EXECUTE d;
END $$;