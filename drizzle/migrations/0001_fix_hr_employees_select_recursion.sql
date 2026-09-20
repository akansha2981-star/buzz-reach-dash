CREATE OR REPLACE FUNCTION public.is_people_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hr_employees m
    WHERE m.user_id = auth.uid()
      AND m.hr_role = ANY (ARRAY['manager'::public.hr_role, 'team_leader'::public.hr_role])
  )
$$;

DROP POLICY IF EXISTS hr_emp_select ON public.hr_employees;

CREATE POLICY hr_emp_select ON public.hr_employees
FOR SELECT TO authenticated
USING (
  public.is_hr_admin()
  OR user_id = auth.uid()
  OR reporting_manager_id = public.current_employee_id()
  OR public.is_people_manager()
);