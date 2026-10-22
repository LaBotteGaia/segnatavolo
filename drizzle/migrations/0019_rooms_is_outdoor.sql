ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS is_outdoor boolean NOT NULL DEFAULT false;
UPDATE public.rooms SET is_outdoor = (environment = 'esterno');
CREATE OR REPLACE FUNCTION public.sync_room_outdoor() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_outdoor IS DISTINCT FROM OLD.is_outdoor THEN
    NEW.environment := CASE WHEN NEW.is_outdoor THEN 'esterno' ELSE 'interno' END;
  ELSIF TG_OP = 'INSERT' AND NEW.is_outdoor THEN
    NEW.environment := 'esterno';
  ELSE
    NEW.is_outdoor := (NEW.environment = 'esterno');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rooms_sync_outdoor ON public.rooms;
CREATE TRIGGER rooms_sync_outdoor BEFORE INSERT OR UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.sync_room_outdoor();