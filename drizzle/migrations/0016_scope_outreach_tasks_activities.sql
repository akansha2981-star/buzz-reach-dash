DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
USING (public.has_outreach_access(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
USING (public.has_outreach_access(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_outreach_access(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS activities_select ON public.outreach_activities;
CREATE POLICY activities_select ON public.outreach_activities FOR SELECT TO authenticated
USING (public.has_outreach_access(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));