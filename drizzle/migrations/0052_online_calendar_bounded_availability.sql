DO $$ DECLARE def text; old text; BEGIN
SELECT pg_get_functiondef('public.get_online_booking_page(text)'::regprocedure) INTO def;
old:='(SELECT max((s->>''remaining'')::int) FROM jsonb_array_elements(public.get_online_booking_slots(_slug,d::date,''pranzo'')) s)'; IF position(old IN def)=0 THEN RAISE EXCEPTION 'Contratto pagina cambiato'; END IF;
def:=replace(def,old,'public.online_shift_remaining(r.id,d::date,''pranzo'')');
def:=replace(def,'(SELECT max((s->>''remaining'')::int) FROM jsonb_array_elements(public.get_online_booking_slots(_slug,d::date,''sera'')) s)','public.online_shift_remaining(r.id,d::date,''sera'')'); EXECUTE def;
END $$;