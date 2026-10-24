CREATE OR REPLACE FUNCTION public.guard_master_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE rid uuid;
BEGIN
 IF auth.uid() IS NULL AND current_user IN ('postgres','service_role','supabase_admin') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='INSERT' THEN rid:=NEW.restaurant_id;
 ELSIF TG_TABLE_NAME='restaurants' THEN rid:=OLD.id;
 ELSE rid:=OLD.restaurant_id; END IF;
 IF NOT public.can_configure_delivery(rid) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Modifica non consentita: permessi riservati all''utente Master del ristorante'; END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME<>'restaurants' THEN
  IF NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id AND NOT public.can_configure_delivery(NEW.restaurant_id) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Modifica non consentita: permessi riservati all''utente Master del ristorante'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.guard_island_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN IF NEW.table_ids IS NOT DISTINCT FROM OLD.table_ids THEN RETURN NEW; END IF; END IF;
 IF cardinality(NEW.table_ids)>1 AND EXISTS(SELECT 1 FROM public.restaurant_tables WHERE restaurant_id=NEW.restaurant_id AND id=ANY(NEW.table_ids) AND NOT accoppiabile) THEN RAISE EXCEPTION 'Unione non consentita: un tavolo Isola non può essere accoppiato'; END IF;
 RETURN NEW;
END $$;