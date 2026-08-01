CREATE TABLE public.accounts_manual_income (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  payer text,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  received_on date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  bank_account_id uuid REFERENCES public.accounts_bank_accounts(id) ON DELETE SET NULL,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_manual_income TO authenticated;
GRANT ALL ON public.accounts_manual_income TO service_role;

ALTER TABLE public.accounts_manual_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_manual_income_all" ON public.accounts_manual_income
FOR ALL TO authenticated
USING (public.has_accounts_access(auth.uid()))
WITH CHECK (public.has_accounts_access(auth.uid()));

CREATE TRIGGER accounts_manual_income_touch
BEFORE UPDATE ON public.accounts_manual_income
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();