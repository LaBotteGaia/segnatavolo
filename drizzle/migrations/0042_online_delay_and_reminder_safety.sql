ALTER TABLE public.reservations ADD COLUMN delay_notified boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.cancel_overdue_online_bookings() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE venue record; changed integer; total integer:=0; BEGIN
 FOR venue IN SELECT id,timezone,no_show_tolerance_minutes FROM public.restaurants LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(venue.id::text,0));
  UPDATE public.reservations SET confirmation_status='cancellata_no_show',deleted_at=now(),table_ids='{}',no_show=true WHERE restaurant_id=venue.id AND channel='online' AND status='confirmed' AND deleted_at IS NULL AND NOT arrived AND NOT delay_notified AND date=(now() AT TIME ZONE venue.timezone)::date AND time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND now() > ((date::text||' '||time)::timestamp AT TIME ZONE venue.timezone)+make_interval(mins=>venue.no_show_tolerance_minutes);
  GET DIAGNOSTICS changed=ROW_COUNT; total:=total+changed;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.cancel_overdue_online_bookings() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.cancel_overdue_online_bookings() TO service_role;
DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.manage_online_reservation(uuid,text)'::regprocedure) INTO def;
 def:=replace(def,'SELECT * INTO r FROM public.reservations WHERE management_token=_token AND channel=''online'' FOR UPDATE;', 'SELECT * INTO r FROM public.reservations WHERE management_token=_token AND channel=''online''; IF NOT FOUND THEN RAISE EXCEPTION ''Link non valido''; END IF; PERFORM pg_advisory_xact_lock(hashtextextended(r.restaurant_id::text,0)); SELECT * INTO r FROM public.reservations WHERE id=r.id FOR UPDATE;');
 EXECUTE def;
END $$;
CREATE OR REPLACE FUNCTION public.guard_reconfirmation_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND (NEW.management_token IS DISTINCT FROM OLD.management_token OR NEW.morning_reminder_sent_at IS DISTINCT FROM OLD.morning_reminder_sent_at OR NEW.morning_reminder_attempted_at IS DISTINCT FROM OLD.morning_reminder_attempted_at OR NEW.morning_reminder_error IS DISTINCT FROM OLD.morning_reminder_error) THEN RAISE EXCEPTION 'Campi promemoria protetti'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER reconfirmation_fields_guard BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_reconfirmation_fields();