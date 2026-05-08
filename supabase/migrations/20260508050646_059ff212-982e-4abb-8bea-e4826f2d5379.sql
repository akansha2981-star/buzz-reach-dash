ALTER TABLE public.ceo_desk_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS deadline_at timestamp with time zone;