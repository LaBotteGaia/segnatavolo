ALTER TABLE public.restaurant_assignment_rules ADD COLUMN IF NOT EXISTS rule_hash text;
CREATE INDEX IF NOT EXISTS assignment_rules_recent_hash_idx ON public.restaurant_assignment_rules (restaurant_id, rule_hash, created_at DESC);
CREATE OR REPLACE FUNCTION public.guard_recent_assignment_rule() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE fingerprint text;
BEGIN
  IF NEW.restaurant_id IS NULL THEN RAISE EXCEPTION 'Ristorante richiesto' USING ERRCODE = '23502'; END IF;
  fingerprint := md5(lower(regexp_replace(btrim(NEW.raw_text), '\s+', ' ', 'g')));
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.restaurant_id::text, 81421));
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM public.restaurant_assignment_rules r
    WHERE r.restaurant_id = NEW.restaurant_id
      AND coalesce(r.rule_hash, md5(lower(regexp_replace(btrim(r.raw_text), '\s+', ' ', 'g')))) = fingerprint
      AND r.created_at >= clock_timestamp() - interval '10 seconds'
  ) THEN
    RAISE EXCEPTION 'Questa regola è già stata salvata negli ultimi 10 secondi.' USING ERRCODE = '23505';
  END IF;
  NEW.rule_hash := fingerprint;
  IF TG_OP = 'INSERT' THEN NEW.created_at := clock_timestamp(); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assignment_rule_recent_dedup BEFORE INSERT OR UPDATE OF raw_text, restaurant_id ON public.restaurant_assignment_rules FOR EACH ROW EXECUTE FUNCTION public.guard_recent_assignment_rule();
COMMENT ON COLUMN public.restaurant_assignment_rules.rule_hash IS 'Fingerprint del testo normalizzato: duplicati bloccati per ristorante entro 10 secondi, senza vietare un reinserimento successivo.';