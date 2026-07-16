
-- Documents
CREATE TABLE public.me_confidential_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  link text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.me_confidential_documents TO authenticated;
GRANT ALL ON public.me_confidential_documents TO service_role;
ALTER TABLE public.me_confidential_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own confidential documents" ON public.me_confidential_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_me_conf_docs_updated_at BEFORE UPDATE ON public.me_confidential_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Passwords
CREATE TABLE public.me_confidential_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  username text,
  password text NOT NULL,
  url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.me_confidential_passwords TO authenticated;
GRANT ALL ON public.me_confidential_passwords TO service_role;
ALTER TABLE public.me_confidential_passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own confidential passwords" ON public.me_confidential_passwords
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_me_conf_pw_updated_at BEFORE UPDATE ON public.me_confidential_passwords
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- APIs
CREATE TABLE public.me_confidential_apis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  api_key text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.me_confidential_apis TO authenticated;
GRANT ALL ON public.me_confidential_apis TO service_role;
ALTER TABLE public.me_confidential_apis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own confidential apis" ON public.me_confidential_apis
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_me_conf_apis_updated_at BEFORE UPDATE ON public.me_confidential_apis
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
