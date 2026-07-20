
CREATE TABLE public.accounts_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  brand TEXT NOT NULL DEFAULT '',
  legal_name TEXT NOT NULL DEFAULT '',
  cin TEXT,
  pan TEXT,
  tan TEXT,
  gstin TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  signatory TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_company_settings TO authenticated;
GRANT ALL ON public.accounts_company_settings TO service_role;

ALTER TABLE public.accounts_company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own company settings" ON public.accounts_company_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_accounts_company_settings_updated
  BEFORE UPDATE ON public.accounts_company_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
