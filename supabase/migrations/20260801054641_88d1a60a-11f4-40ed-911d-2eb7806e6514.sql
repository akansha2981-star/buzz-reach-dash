CREATE TABLE public.accounts_investments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  invested_on date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  bank_account_id uuid REFERENCES public.accounts_bank_accounts(id) ON DELETE SET NULL,
  expected_return numeric,
  current_value numeric,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_investments TO authenticated;
GRANT ALL ON public.accounts_investments TO service_role;

ALTER TABLE public.accounts_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_investments_all" ON public.accounts_investments
FOR ALL TO authenticated
USING (public.has_accounts_access(auth.uid()))
WITH CHECK (public.has_accounts_access(auth.uid()));

CREATE TRIGGER accounts_investments_touch
BEFORE UPDATE ON public.accounts_investments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();