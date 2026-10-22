GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own admin status" ON public.platform_admins;
CREATE POLICY "read own admin status" ON public.platform_admins FOR SELECT TO authenticated USING (id = auth.uid());