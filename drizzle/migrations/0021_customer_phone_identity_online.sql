DROP INDEX IF EXISTS public.customers_name_lower_idx;
CREATE INDEX IF NOT EXISTS customers_tenant_name_lookup ON public.customers(restaurant_id,lower(name));
CREATE INDEX IF NOT EXISTS customers_tenant_phone_lookup ON public.customers(restaurant_id,(regexp_replace(phone,'[\s\-./()]','','g')));