
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS can_accounts boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.has_accounts_access(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _uid AND can_accounts = true);
$$;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.accounts_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client text NOT NULL,
  invoice_number text,
  amount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  attachment_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_invoices TO authenticated;
GRANT ALL ON public.accounts_invoices TO service_role;
ALTER TABLE public.accounts_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_invoices_access" ON public.accounts_invoices FOR ALL TO authenticated
  USING (public.has_accounts_access(auth.uid())) WITH CHECK (public.has_accounts_access(auth.uid()));

CREATE TABLE public.accounts_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  vendor text,
  payment_method text,
  notes text,
  attachment_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_expenses TO authenticated;
GRANT ALL ON public.accounts_expenses TO service_role;
ALTER TABLE public.accounts_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_expenses_access" ON public.accounts_expenses FOR ALL TO authenticated
  USING (public.has_accounts_access(auth.uid())) WITH CHECK (public.has_accounts_access(auth.uid()));

CREATE TABLE public.accounts_recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  frequency text NOT NULL DEFAULT 'monthly',
  next_due date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_recurring_expenses TO authenticated;
GRANT ALL ON public.accounts_recurring_expenses TO service_role;
ALTER TABLE public.accounts_recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_recurring_access" ON public.accounts_recurring_expenses FOR ALL TO authenticated
  USING (public.has_accounts_access(auth.uid())) WITH CHECK (public.has_accounts_access(auth.uid()));

CREATE TRIGGER trg_accounts_invoices_updated BEFORE UPDATE ON public.accounts_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_accounts_expenses_updated BEFORE UPDATE ON public.accounts_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_accounts_recurring_updated BEFORE UPDATE ON public.accounts_recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
