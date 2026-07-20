
CREATE TABLE public.accounts_recurring_expense_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_expense_id uuid NOT NULL REFERENCES public.accounts_recurring_expenses(id) ON DELETE CASCADE,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  period_month date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  method text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_recurring_expense_payments TO authenticated;
GRANT ALL ON public.accounts_recurring_expense_payments TO service_role;
ALTER TABLE public.accounts_recurring_expense_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts users read recurring payments" ON public.accounts_recurring_expense_payments
  FOR SELECT TO authenticated USING (public.has_accounts_access(auth.uid()));
CREATE POLICY "accounts users write recurring payments" ON public.accounts_recurring_expense_payments
  FOR INSERT TO authenticated WITH CHECK (public.has_accounts_access(auth.uid()));
CREATE POLICY "accounts users update recurring payments" ON public.accounts_recurring_expense_payments
  FOR UPDATE TO authenticated USING (public.has_accounts_access(auth.uid()));
CREATE POLICY "accounts users delete recurring payments" ON public.accounts_recurring_expense_payments
  FOR DELETE TO authenticated USING (public.has_accounts_access(auth.uid()));
CREATE INDEX idx_arep_recurring ON public.accounts_recurring_expense_payments(recurring_expense_id);
CREATE INDEX idx_arep_period ON public.accounts_recurring_expense_payments(period_month);
CREATE TRIGGER trg_arep_updated BEFORE UPDATE ON public.accounts_recurring_expense_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
