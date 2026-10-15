ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'interno' CHECK (environment IN ('interno','esterno'));
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS capacity integer CHECK (capacity IS NULL OR capacity >= 0);
COMMENT ON COLUMN public.rooms.capacity IS 'Max covers per shift; NULL = sum of table seats';