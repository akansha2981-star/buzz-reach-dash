ALTER TABLE public.user_permissions ADD COLUMN can_lms boolean NOT NULL DEFAULT false;

CREATE TABLE public.lms_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  phone text,
  email text,
  year smallint NOT NULL CHECK (year BETWEEN 2020 AND 2029),
  source text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_leads TO authenticated;
GRANT ALL ON public.lms_leads TO service_role;

CREATE OR REPLACE FUNCTION public.has_lms_access(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _uid AND can_lms = true
    )
$$;

ALTER TABLE public.lms_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY lms_leads_access ON public.lms_leads
  FOR ALL TO authenticated
  USING (public.has_lms_access(auth.uid()))
  WITH CHECK (public.has_lms_access(auth.uid()));

CREATE INDEX lms_leads_year_idx ON public.lms_leads (year DESC, created_at DESC);
CREATE INDEX lms_leads_created_idx ON public.lms_leads (created_at DESC);

CREATE TRIGGER lms_leads_touch_updated_at
  BEFORE UPDATE ON public.lms_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();