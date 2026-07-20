ALTER TABLE public.accounts_invoices
  ADD COLUMN IF NOT EXISTS client_location text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'Bank Transfer',
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;