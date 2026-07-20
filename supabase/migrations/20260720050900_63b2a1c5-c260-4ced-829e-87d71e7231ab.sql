
CREATE TABLE public.accounts_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc TEXT,
  bank_name TEXT,
  branch TEXT,
  branch_address TEXT,
  upi_id TEXT,
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_bank_accounts TO authenticated;
GRANT ALL ON public.accounts_bank_accounts TO service_role;

ALTER TABLE public.accounts_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounts users can manage bank accounts"
  ON public.accounts_bank_accounts
  FOR ALL
  USING (public.has_accounts_access(auth.uid()))
  WITH CHECK (public.has_accounts_access(auth.uid()));

CREATE TRIGGER trg_accounts_bank_accounts_updated
  BEFORE UPDATE ON public.accounts_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.accounts_invoices
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.accounts_bank_accounts(id) ON DELETE SET NULL;
