-- Islands remain excluded by automatic allocation; manual operator assignments may force a union after explicit UI confirmation.
CREATE OR REPLACE FUNCTION public.guard_island_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 RETURN NEW;
END $$;
DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.claim_morning_reminder()'::regprocedure) INTO def;
 def:=replace(def,'AND b.morning_reminder_attempted_at IS NULL','AND b.morning_reminder_sent_at IS NULL AND (b.morning_reminder_attempted_at IS NULL OR b.morning_reminder_attempted_at < now()-interval ''15 minutes'')');
 EXECUTE def;
END $$;