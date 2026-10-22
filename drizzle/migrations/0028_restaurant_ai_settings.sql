CREATE TABLE public.restaurant_ai_settings (restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE, enabled boolean NOT NULL DEFAULT false, provider text NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai','gemini')), encrypted_key text, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.restaurant_ai_settings TO service_role;
ALTER TABLE public.restaurant_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.can_use_restaurant(_rid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND (public.is_super_admin() OR EXISTS(SELECT 1 FROM public.restaurant_members WHERE restaurant_id=_rid AND user_id=auth.uid() AND status='active')) $$;
REVOKE ALL ON FUNCTION public.can_use_restaurant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_restaurant(uuid) TO authenticated;