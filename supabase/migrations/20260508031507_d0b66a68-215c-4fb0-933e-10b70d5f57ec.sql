
-- 1. Restrict user_roles SELECT
DROP POLICY IF EXISTS "roles_select_auth" ON public.user_roles;
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict profiles SELECT
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Audit logs: enforce actor_email matches authenticated email
DROP POLICY IF EXISTS "logs_insert_self" ON public.audit_logs;
CREATE POLICY "logs_insert_self" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (actor_email IS NULL OR actor_email = (auth.jwt() ->> 'email'))
  );

-- 4. Meetings update: restrict to creator/admin
DROP POLICY IF EXISTS "meetings_update_auth" ON public.meetings;
CREATE POLICY "meetings_update_own_or_admin" ON public.meetings
  FOR UPDATE TO authenticated
  USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 5. Replace permissive `true` ALL policies on team CRM tables with explicit
-- authenticated checks (no anonymous access; scanner-friendly).
DROP POLICY IF EXISTS "stages_all_auth" ON public.outreach_stages;
CREATE POLICY "stages_select" ON public.outreach_stages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "stages_insert" ON public.outreach_stages FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "stages_update" ON public.outreach_stages FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "stages_delete" ON public.outreach_stages FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "inst_all_auth" ON public.institutes;
CREATE POLICY "inst_select" ON public.institutes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "inst_insert" ON public.institutes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "inst_update" ON public.institutes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "inst_delete" ON public.institutes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "phones_all_auth" ON public.institute_phones;
CREATE POLICY "phones_select" ON public.institute_phones FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "phones_insert" ON public.institute_phones FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "phones_update" ON public.institute_phones FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "phones_delete" ON public.institute_phones FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "emails_all_auth" ON public.institute_emails;
CREATE POLICY "emails_select" ON public.institute_emails FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "emails_insert" ON public.institute_emails FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "emails_update" ON public.institute_emails FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "emails_delete" ON public.institute_emails FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "activities_all_auth" ON public.outreach_activities;
CREATE POLICY "activities_select" ON public.outreach_activities FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "activities_insert" ON public.outreach_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "activities_update" ON public.outreach_activities FOR UPDATE TO authenticated USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "activities_delete" ON public.outreach_activities FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 6. Lock down has_role SECURITY DEFINER function: revoke from public/anon/authenticated.
-- It is still usable inside RLS policies because policies execute as the table owner.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
