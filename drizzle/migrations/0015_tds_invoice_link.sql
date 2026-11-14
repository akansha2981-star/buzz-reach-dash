ALTER TABLE public.accounts_tds ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.accounts_invoices(id) ON DELETE CASCADE;
ALTER TABLE public.accounts_tds ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.accounts_tds ADD COLUMN IF NOT EXISTS invoice_total numeric;
ALTER TABLE public.accounts_tds ADD COLUMN IF NOT EXISTS bank_amount numeric;
CREATE INDEX IF NOT EXISTS accounts_tds_invoice_idx ON public.accounts_tds(invoice_id);