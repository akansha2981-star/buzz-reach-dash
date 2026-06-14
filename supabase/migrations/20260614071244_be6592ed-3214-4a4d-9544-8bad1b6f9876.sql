
-- 1. Fix privilege escalation: restrict self-update on hr_employees so employees
--    cannot change hr_role, status, or reporting_manager_id on their own row.
DROP POLICY IF EXISTS hr_emp_update ON public.hr_employees;

CREATE POLICY hr_emp_update ON public.hr_employees
  FOR UPDATE
  USING (is_hr_admin() OR user_id = auth.uid())
  WITH CHECK (
    is_hr_admin()
    OR (
      user_id = auth.uid()
      AND hr_role IS NOT DISTINCT FROM (SELECT e.hr_role FROM public.hr_employees e WHERE e.id = hr_employees.id)
      AND status  IS NOT DISTINCT FROM (SELECT e.status  FROM public.hr_employees e WHERE e.id = hr_employees.id)
      AND reporting_manager_id IS NOT DISTINCT FROM (SELECT e.reporting_manager_id FROM public.hr_employees e WHERE e.id = hr_employees.id)
      AND employee_code IS NOT DISTINCT FROM (SELECT e.employee_code FROM public.hr_employees e WHERE e.id = hr_employees.id)
      AND department_id IS NOT DISTINCT FROM (SELECT e.department_id FROM public.hr_employees e WHERE e.id = hr_employees.id)
      AND employment_type IS NOT DISTINCT FROM (SELECT e.employment_type FROM public.hr_employees e WHERE e.id = hr_employees.id)
      AND joining_date IS NOT DISTINCT FROM (SELECT e.joining_date FROM public.hr_employees e WHERE e.id = hr_employees.id)
    )
  );

-- 2. Allow managers to download hr-docs files for their direct reports,
--    matching the visibility they already have on hr_documents metadata.
DROP POLICY IF EXISTS hr_storage_select ON storage.objects;

CREATE POLICY hr_storage_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'hr-docs'
    AND (
      is_hr_admin()
      OR (storage.foldername(name))[1] = (current_employee_id())::text
      OR public.is_manager_of(((storage.foldername(name))[1])::uuid)
    )
  );
