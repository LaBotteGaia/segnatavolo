ALTER TABLE public.restaurant_whatsapp_settings
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
COMMENT ON COLUMN public.restaurant_whatsapp_settings.waba_id IS 'WhatsApp Business Account ID ottenuto tramite Meta Embedded Signup';