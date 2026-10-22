ALTER TABLE public.restaurant_members ADD COLUMN phone text NOT NULL DEFAULT '', ADD COLUMN notes text NOT NULL DEFAULT '', ADD COLUMN operational_role text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.restaurant_members.operational_role IS 'Descriptive service job only; does not grant authorization privileges.';
CREATE OR REPLACE FUNCTION public.update_operator_profile(_name text, _phone text, _notes text, _operational_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
IF _name IS NULL OR length(trim(_name)) = 0 OR length(trim(_name)) > 80 THEN RAISE EXCEPTION 'Inserisci un nome operatore valido (massimo 80 caratteri)'; END IF;
IF length(coalesce(_phone,'')) > 40 OR length(coalesce(_notes,'')) > 2000 OR length(coalesce(_operational_role,'')) > 80 THEN RAISE EXCEPTION 'Dati del profilo non validi'; END IF;
UPDATE public.restaurant_members SET name=trim(_name), phone=trim(coalesce(_phone,'')), notes=trim(coalesce(_notes,'')), operational_role=trim(coalesce(_operational_role,'')) WHERE user_id=auth.uid() AND status='active';
IF NOT FOUND THEN RAISE EXCEPTION 'Accesso non autorizzato'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.update_operator_profile(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operator_profile(text,text,text,text) TO authenticated;
CREATE POLICY "super admin manage members" ON public.restaurant_members FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
GRANT INSERT ON public.restaurant_members TO authenticated;
CREATE POLICY "super admin manage invites" ON public.restaurant_invites FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());