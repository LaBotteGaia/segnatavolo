CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
  _restaurant uuid;
  _role text;
  _other_masters int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Accesso richiesto';
  END IF;

  SELECT restaurant_id, role INTO _restaurant, _role
  FROM public.restaurant_members
  WHERE user_id = _uid AND status = 'active'
  LIMIT 1;

  IF _restaurant IS NULL THEN
    RAISE EXCEPTION 'Nessuna membership attiva da eliminare';
  END IF;

  -- Un Master non puo' eliminarsi se e' l'ultimo Master attivo del ristorante.
  IF _role = 'master' THEN
    SELECT count(*) INTO _other_masters
    FROM public.restaurant_members
    WHERE restaurant_id = _restaurant AND role = 'master' AND status = 'active' AND user_id <> _uid;
    IF _other_masters = 0 THEN
      RAISE EXCEPTION 'Sei l''unico Master del ristorante: nomina prima un altro Master dalla Gestione Utenti';
    END IF;
  END IF;

  -- Rimuove la membership (l'audit resta: created_by_name/updated_by_name sono testo copiato).
  DELETE FROM public.restaurant_members WHERE user_id = _uid;

  -- Elimina l'utenza Auth: revoke immediato dell'accesso.
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;