
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Outreach stages (shared by colleges & coaching)
CREATE TABLE public.outreach_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.outreach_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stages_all_auth" ON public.outreach_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.outreach_stages (name, position, color) VALUES
  ('First Email Sent', 1, '#3b82f6'),
  ('Second Email Sent', 2, '#06b6d4'),
  ('Follow Up Done', 3, '#8b5cf6'),
  ('Meeting Scheduled', 4, '#f59e0b'),
  ('Meeting Completed', 5, '#10b981'),
  ('Collaboration Discussion', 6, '#ec4899'),
  ('Proposal Sent', 7, '#f97316'),
  ('Deal Closed', 8, '#22c55e');

-- Institutes (colleges + coaching)
CREATE TYPE public.institute_type AS ENUM ('college', 'coaching');

CREATE TABLE public.institutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.institute_type NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  website TEXT,
  contact_person TEXT,
  contact_designation TEXT,
  current_stage_id UUID REFERENCES public.outreach_stages(id) ON DELETE SET NULL,
  notes TEXT,
  next_meeting_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inst_all_auth" ON public.institutes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.institute_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT
);
ALTER TABLE public.institute_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emails_all_auth" ON public.institute_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.institute_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  label TEXT
);
ALTER TABLE public.institute_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phones_all_auth" ON public.institute_phones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.outreach_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.outreach_stages(id) ON DELETE SET NULL,
  stage_name_snapshot TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.outreach_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_all_auth" ON public.outreach_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_inst_type ON public.institutes(type);
CREATE INDEX idx_inst_stage ON public.institutes(current_stage_id);
CREATE INDEX idx_act_inst ON public.outreach_activities(institute_id, created_at DESC);
