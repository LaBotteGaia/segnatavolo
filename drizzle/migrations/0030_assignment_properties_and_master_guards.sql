ALTER TABLE public.restaurant_tables ADD COLUMN accoppiabile boolean NOT NULL DEFAULT true, ADD COLUMN adatto_seduta_lunga boolean NOT NULL DEFAULT false;
ALTER TABLE public.restaurant_tables ALTER COLUMN ordine_riempimento SET DEFAULT 10;
CREATE OR REPLACE FUNCTION public.guard_master_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE rid uuid;
BEGIN
 IF auth.uid() IS NULL AND current_user IN ('postgres','service_role','supabase_admin') THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_TABLE_NAME='restaurants' THEN rid:=coalesce(NEW.id,OLD.id); ELSE rid:=coalesce(NEW.restaurant_id,OLD.restaurant_id); END IF;
 IF NOT public.can_configure_delivery(rid) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Modifica non consentita: permessi riservati all''utente Master del ristorante'; END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME<>'restaurants' AND NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id AND NOT public.can_configure_delivery(NEW.restaurant_id) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Modifica non consentita: permessi riservati all''utente Master del ristorante'; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER guard_master_config BEFORE INSERT OR UPDATE OR DELETE ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION public.guard_master_configuration();
CREATE TRIGGER guard_master_config BEFORE INSERT OR UPDATE OR DELETE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.guard_master_configuration();
CREATE TRIGGER guard_master_config BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.guard_master_configuration();
CREATE OR REPLACE FUNCTION public.guard_island_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL OR NEW.table_ids IS NOT DISTINCT FROM OLD.table_ids THEN RETURN NEW; END IF;
 IF cardinality(NEW.table_ids)>1 AND EXISTS(SELECT 1 FROM public.restaurant_tables WHERE restaurant_id=NEW.restaurant_id AND id=ANY(NEW.table_ids) AND NOT accoppiabile) THEN RAISE EXCEPTION 'Unione non consentita: un tavolo Isola non può essere accoppiato'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_island_assignment BEFORE INSERT OR UPDATE OF table_ids ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_island_assignment();