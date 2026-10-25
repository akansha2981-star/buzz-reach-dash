CREATE TABLE public.accounts_tds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tds_date date NOT NULL,
 amount numeric(14,2) NOT NULL CHECK (amount > 0),
 company_name text NOT NULL CHECK (length(btrim(company_name)) > 0),
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_tds TO authenticated;
GRANT ALL ON public.accounts_tds TO service_role;
ALTER TABLE public.accounts_tds ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_tds_access ON public.accounts_tds FOR ALL TO authenticated USING (public.has_accounts_access(auth.uid())) WITH CHECK (public.has_accounts_access(auth.uid()));
CREATE INDEX accounts_tds_date_idx ON public.accounts_tds (tds_date DESC);
CREATE TRIGGER accounts_tds_updated_at BEFORE UPDATE ON public.accounts_tds FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();