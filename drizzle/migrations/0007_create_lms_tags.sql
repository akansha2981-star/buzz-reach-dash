CREATE TABLE public.lms_tag_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  color text NOT NULL DEFAULT '#0f766e',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lms_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.lms_tag_categories(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

CREATE TABLE public.lms_lead_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.lms_leads(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.lms_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_tag_categories TO authenticated;
GRANT ALL ON public.lms_tag_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_tags TO authenticated;
GRANT ALL ON public.lms_tags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_lead_tags TO authenticated;
GRANT ALL ON public.lms_lead_tags TO service_role;

ALTER TABLE public.lms_tag_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_lead_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY lms_tag_categories_access ON public.lms_tag_categories
  FOR ALL TO authenticated
  USING (public.has_lms_access(auth.uid()))
  WITH CHECK (public.has_lms_access(auth.uid()));

CREATE POLICY lms_tags_access ON public.lms_tags
  FOR ALL TO authenticated
  USING (public.has_lms_access(auth.uid()))
  WITH CHECK (public.has_lms_access(auth.uid()));

CREATE POLICY lms_lead_tags_access ON public.lms_lead_tags
  FOR ALL TO authenticated
  USING (public.has_lms_access(auth.uid()))
  WITH CHECK (public.has_lms_access(auth.uid()));

CREATE INDEX lms_tags_category_idx ON public.lms_tags (category_id);
CREATE INDEX lms_lead_tags_lead_idx ON public.lms_lead_tags (lead_id);
CREATE INDEX lms_lead_tags_tag_idx ON public.lms_lead_tags (tag_id);

CREATE TRIGGER lms_tag_categories_touch_updated_at
  BEFORE UPDATE ON public.lms_tag_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();