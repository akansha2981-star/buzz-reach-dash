DROP POLICY IF EXISTS hr_ltypes_select ON public.hr_leave_types;
CREATE POLICY hr_ltypes_select ON public.hr_leave_types FOR SELECT TO authenticated
  USING (public.current_employee_id() IS NOT NULL OR public.is_hr_admin());
DROP POLICY IF EXISTS hr_holidays_select ON public.hr_holidays;
CREATE POLICY hr_holidays_select ON public.hr_holidays FOR SELECT TO authenticated
  USING (public.current_employee_id() IS NOT NULL OR public.is_hr_admin());
DROP POLICY IF EXISTS hr_dept_select ON public.hr_departments;
CREATE POLICY hr_dept_select ON public.hr_departments FOR SELECT TO authenticated
  USING (public.current_employee_id() IS NOT NULL OR public.is_hr_admin());
DROP POLICY IF EXISTS meetings_select_auth ON public.meetings;
CREATE POLICY meetings_select_auth ON public.meetings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = auth.uid() AND (p.can_meetings OR p.can_dashboard)));
DROP POLICY IF EXISTS institute_docs_read ON storage.objects;
CREATE POLICY institute_docs_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'institute-docs' AND (owner_id = (select auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = auth.uid() AND p.can_documents)));