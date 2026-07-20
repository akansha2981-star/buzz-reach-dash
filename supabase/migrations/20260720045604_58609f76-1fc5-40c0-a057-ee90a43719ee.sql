-- Payments per invoice
CREATE TABLE IF NOT EXISTS public.accounts_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.accounts_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_invoice_payments TO authenticated;
GRANT ALL ON public.accounts_invoice_payments TO service_role;

ALTER TABLE public.accounts_invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_invoice_payments_access"
  ON public.accounts_invoice_payments
  FOR ALL
  TO authenticated
  USING (public.has_accounts_access(auth.uid()))
  WITH CHECK (public.has_accounts_access(auth.uid()));

CREATE TRIGGER trg_accounts_invoice_payments_updated
  BEFORE UPDATE ON public.accounts_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_accounts_invoice_payments_invoice ON public.accounts_invoice_payments(invoice_id);