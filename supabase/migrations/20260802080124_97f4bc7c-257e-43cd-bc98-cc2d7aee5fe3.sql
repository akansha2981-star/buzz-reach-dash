CREATE TABLE public.accounts_personal_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  spent_on date NOT NULL DEFAULT current_date,
  payment_method text,
  bank_account_id uuid REFERENCES public.accounts_bank_accounts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_personal_expenses TO authenticated;
GRANT ALL ON public.accounts_personal_expenses TO service_role;

ALTER TABLE public.accounts_personal_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accounts users manage personal expenses"
ON public.accounts_personal_expenses FOR ALL TO authenticated
USING (public.has_accounts_access(auth.uid()))
WITH CHECK (public.has_accounts_access(auth.uid()));

CREATE TRIGGER trg_personal_expenses_updated_at
BEFORE UPDATE ON public.accounts_personal_expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();