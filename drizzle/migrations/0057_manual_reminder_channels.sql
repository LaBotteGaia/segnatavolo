ALTER TABLE public.restaurants ADD COLUMN reminder_default_channel text NOT NULL DEFAULT 'ask' CHECK (reminder_default_channel IN ('ask','email','whatsapp'));
ALTER TABLE public.reservations ADD COLUMN reminder_channel text NOT NULL DEFAULT 'automatic' CHECK (reminder_channel IN ('automatic','email','whatsapp'));
CREATE TABLE public.reservation_reminder_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK (channel IN ('email','whatsapp')), outcome text NOT NULL CHECK (outcome IN ('sending','accepted','failed','opened','unknown')),
 operator_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), detail text
);
GRANT SELECT ON public.reservation_reminder_logs TO authenticated;
GRANT ALL ON public.reservation_reminder_logs TO service_role;
ALTER TABLE public.reservation_reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminder_logs_tenant_read ON public.reservation_reminder_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.restaurant_members m WHERE m.restaurant_id=reservation_reminder_logs.restaurant_id AND m.user_id=auth.uid() AND m.status='active') OR public.is_super_admin());
CREATE INDEX reservation_reminder_logs_lookup ON public.reservation_reminder_logs(restaurant_id,reservation_id,created_at DESC);