
CREATE TABLE public.accounts_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  location TEXT,
  email TEXT,
  phone TEXT,
  category TEXT,
  gstin TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_clients TO authenticated;
GRANT ALL ON public.accounts_clients TO service_role;
ALTER TABLE public.accounts_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounts users can view clients" ON public.accounts_clients
  FOR SELECT TO authenticated USING (public.has_accounts_access(auth.uid()));
CREATE POLICY "Accounts users can insert clients" ON public.accounts_clients
  FOR INSERT TO authenticated WITH CHECK (public.has_accounts_access(auth.uid()));
CREATE POLICY "Accounts users can update clients" ON public.accounts_clients
  FOR UPDATE TO authenticated USING (public.has_accounts_access(auth.uid())) WITH CHECK (public.has_accounts_access(auth.uid()));
CREATE POLICY "Accounts users can delete clients" ON public.accounts_clients
  FOR DELETE TO authenticated USING (public.has_accounts_access(auth.uid()));
CREATE TRIGGER trg_accounts_clients_updated_at BEFORE UPDATE ON public.accounts_clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_accounts_clients_name ON public.accounts_clients (lower(name));
