CREATE TABLE public.restaurant_whatsapp_settings (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  phone_number_id text,
  display_phone text,
  template_name text,
  template_language text NOT NULL DEFAULT 'it',
  encrypted_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.restaurant_whatsapp_settings TO service_role;
ALTER TABLE public.restaurant_whatsapp_settings ENABLE ROW LEVEL SECURITY;