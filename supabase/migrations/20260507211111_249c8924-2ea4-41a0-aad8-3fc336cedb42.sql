
-- ============ MEETINGS ============
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id uuid REFERENCES public.institutes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  meeting_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  platform text DEFAULT 'google_meet',
  meeting_link text,
  attendees jsonb DEFAULT '[]'::jsonb,
  reminder_minutes integer DEFAULT 15,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_select_auth" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert_auth" ON public.meetings FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "meetings_update_auth" ON public.meetings FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "meetings_delete_admin" ON public.meetings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- ============ PERMISSIONS ============
CREATE TABLE public.user_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_dashboard boolean NOT NULL DEFAULT true,
  can_colleges boolean NOT NULL DEFAULT true,
  can_coaching boolean NOT NULL DEFAULT true,
  can_meetings boolean NOT NULL DEFAULT true,
  can_stages boolean NOT NULL DEFAULT false,
  can_users boolean NOT NULL DEFAULT false,
  can_logs boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perms_select_self_or_admin" ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "perms_admin_insert" ON public.user_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "perms_admin_update" ON public.user_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "perms_admin_delete" ON public.user_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  entity_label text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_admin_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "logs_insert_self" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- timestamp trigger reuse
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_perms_updated BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- give existing admin full perms
INSERT INTO public.user_permissions (user_id, can_dashboard, can_colleges, can_coaching, can_meetings, can_stages, can_users, can_logs)
SELECT user_id, true, true, true, true, true, true, true FROM public.user_roles WHERE role = 'admin'
ON CONFLICT (user_id) DO UPDATE SET can_stages=true, can_users=true, can_logs=true;
