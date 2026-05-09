
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.hr_role AS ENUM ('super_admin','hr_admin','manager','team_leader','employee','intern');
CREATE TYPE public.hr_employment_status AS ENUM ('active','suspended','inactive');
CREATE TYPE public.hr_attendance_status AS ENUM ('present','absent','half_day','late','wfh','holiday','leave');
CREATE TYPE public.hr_leave_status AS ENUM ('pending','manager_approved','approved','rejected','cancelled');

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE public.hr_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  head_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- EMPLOYEES (one row per staff member)
-- user_id links to auth.users for login
-- ============================================================
CREATE TABLE public.hr_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  employee_code text UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text,
  department_id uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  designation text,
  reporting_manager_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  hr_role public.hr_role NOT NULL DEFAULT 'employee',
  employment_type text NOT NULL DEFAULT 'employee',  -- employee | intern | contractor
  status public.hr_employment_status NOT NULL DEFAULT 'active',
  joining_date date,
  date_of_birth date,
  gender text,
  -- personal
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  -- bank
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  pan_number text,
  aadhaar_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_employees_user_id ON public.hr_employees(user_id);
CREATE INDEX idx_hr_employees_dept ON public.hr_employees(department_id);
CREATE INDEX idx_hr_employees_manager ON public.hr_employees(reporting_manager_id);

-- ============================================================
-- HELPER FUNCTIONS (security definer)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.hr_employees WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_hr_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hr_employees
    WHERE user_id = auth.uid()
      AND hr_role IN ('super_admin','hr_admin')
      AND status = 'active'
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hr_employees e
    JOIN public.hr_employees mgr ON mgr.id = e.reporting_manager_id
    WHERE e.id = _employee_id
      AND mgr.user_id = auth.uid()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.current_employee_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hr_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hr_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_of(uuid) TO authenticated;

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE public.hr_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  total_break_minutes integer NOT NULL DEFAULT 0,
  total_work_minutes integer NOT NULL DEFAULT 0,
  status public.hr_attendance_status NOT NULL DEFAULT 'present',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
CREATE INDEX idx_hr_attendance_emp_date ON public.hr_attendance(employee_id, work_date DESC);

CREATE TABLE public.hr_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.hr_attendance(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_breaks_att ON public.hr_breaks(attendance_id);

-- ============================================================
-- LEAVES
-- ============================================================
CREATE TABLE public.hr_leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  default_quota numeric(5,1) NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#6366f1',
  requires_doc boolean NOT NULL DEFAULT false,
  is_paid boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO public.hr_leave_types (code, name, default_quota, color, requires_doc, is_paid) VALUES
  ('CL','Casual Leave',12,'#3b82f6',false,true),
  ('SL','Sick Leave',10,'#ef4444',true,true),
  ('PL','Paid Leave',15,'#10b981',false,true),
  ('EL','Emergency Leave',3,'#f59e0b',false,true),
  ('WFH','Work From Home',24,'#8b5cf6',false,true),
  ('CO','Compensatory Off',6,'#06b6d4',false,true);

CREATE TABLE public.hr_leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  allocated numeric(5,1) NOT NULL DEFAULT 0,
  used numeric(5,1) NOT NULL DEFAULT 0,
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE public.hr_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.hr_leave_types(id),
  from_date date NOT NULL,
  to_date date NOT NULL,
  days numeric(5,1) NOT NULL,
  reason text,
  document_path text,
  status public.hr_leave_status NOT NULL DEFAULT 'pending',
  manager_id uuid REFERENCES public.hr_employees(id),
  manager_decision_at timestamptz,
  manager_comment text,
  hr_id uuid REFERENCES public.hr_employees(id),
  hr_decision_at timestamptz,
  hr_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_leave_req_emp ON public.hr_leave_requests(employee_id);
CREATE INDEX idx_hr_leave_req_status ON public.hr_leave_requests(status);

CREATE TABLE public.hr_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  region text,
  optional boolean NOT NULL DEFAULT false
);

-- ============================================================
-- HR DOCUMENTS
-- ============================================================
CREATE TABLE public.hr_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Other',
  name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_documents_emp ON public.hr_documents(employee_id);

-- ============================================================
-- TRIGGERS FOR updated_at
-- ============================================================
CREATE TRIGGER trg_hr_departments_updated BEFORE UPDATE ON public.hr_departments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_hr_employees_updated BEFORE UPDATE ON public.hr_employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_hr_attendance_updated BEFORE UPDATE ON public.hr_attendance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_hr_leave_requests_updated BEFORE UPDATE ON public.hr_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.hr_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;

-- Departments: all authed read; HR admin write
CREATE POLICY hr_dept_select ON public.hr_departments FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_dept_modify ON public.hr_departments FOR ALL TO authenticated USING (public.is_hr_admin()) WITH CHECK (public.is_hr_admin());

-- Employees: see self + reports + all if HR; modify only HR
CREATE POLICY hr_emp_select ON public.hr_employees FOR SELECT TO authenticated USING (
  public.is_hr_admin()
  OR user_id = auth.uid()
  OR reporting_manager_id = public.current_employee_id()
  OR EXISTS (SELECT 1 FROM public.hr_employees m WHERE m.user_id = auth.uid() AND m.hr_role IN ('manager','team_leader'))
);
CREATE POLICY hr_emp_insert ON public.hr_employees FOR INSERT TO authenticated WITH CHECK (public.is_hr_admin());
CREATE POLICY hr_emp_update ON public.hr_employees FOR UPDATE TO authenticated USING (
  public.is_hr_admin() OR user_id = auth.uid()
) WITH CHECK (public.is_hr_admin() OR user_id = auth.uid());
CREATE POLICY hr_emp_delete ON public.hr_employees FOR DELETE TO authenticated USING (public.is_hr_admin());

-- Attendance: own + manager-of + HR
CREATE POLICY hr_att_select ON public.hr_attendance FOR SELECT TO authenticated USING (
  public.is_hr_admin()
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);
CREATE POLICY hr_att_insert ON public.hr_attendance FOR INSERT TO authenticated WITH CHECK (
  employee_id = public.current_employee_id() OR public.is_hr_admin()
);
CREATE POLICY hr_att_update ON public.hr_attendance FOR UPDATE TO authenticated USING (
  employee_id = public.current_employee_id() OR public.is_hr_admin()
) WITH CHECK (
  employee_id = public.current_employee_id() OR public.is_hr_admin()
);
CREATE POLICY hr_att_delete ON public.hr_attendance FOR DELETE TO authenticated USING (public.is_hr_admin());

-- Breaks: tied to attendance ownership
CREATE POLICY hr_breaks_select ON public.hr_breaks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hr_attendance a WHERE a.id = attendance_id AND (
    public.is_hr_admin() OR a.employee_id = public.current_employee_id() OR public.is_manager_of(a.employee_id)
  ))
);
CREATE POLICY hr_breaks_modify ON public.hr_breaks FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hr_attendance a WHERE a.id = attendance_id AND (
    public.is_hr_admin() OR a.employee_id = public.current_employee_id()
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.hr_attendance a WHERE a.id = attendance_id AND (
    public.is_hr_admin() OR a.employee_id = public.current_employee_id()
  ))
);

-- Leave types: all authed read; HR write
CREATE POLICY hr_ltypes_select ON public.hr_leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_ltypes_modify ON public.hr_leave_types FOR ALL TO authenticated USING (public.is_hr_admin()) WITH CHECK (public.is_hr_admin());

-- Leave balances: own + HR
CREATE POLICY hr_lbal_select ON public.hr_leave_balances FOR SELECT TO authenticated USING (
  public.is_hr_admin() OR employee_id = public.current_employee_id() OR public.is_manager_of(employee_id)
);
CREATE POLICY hr_lbal_modify ON public.hr_leave_balances FOR ALL TO authenticated USING (public.is_hr_admin()) WITH CHECK (public.is_hr_admin());

-- Leave requests
CREATE POLICY hr_lreq_select ON public.hr_leave_requests FOR SELECT TO authenticated USING (
  public.is_hr_admin()
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);
CREATE POLICY hr_lreq_insert ON public.hr_leave_requests FOR INSERT TO authenticated WITH CHECK (
  employee_id = public.current_employee_id()
);
CREATE POLICY hr_lreq_update ON public.hr_leave_requests FOR UPDATE TO authenticated USING (
  public.is_hr_admin()
  OR (employee_id = public.current_employee_id() AND status = 'pending')
  OR public.is_manager_of(employee_id)
) WITH CHECK (
  public.is_hr_admin()
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);
CREATE POLICY hr_lreq_delete ON public.hr_leave_requests FOR DELETE TO authenticated USING (
  public.is_hr_admin() OR (employee_id = public.current_employee_id() AND status = 'pending')
);

-- Holidays: all authed read; HR write
CREATE POLICY hr_holidays_select ON public.hr_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_holidays_modify ON public.hr_holidays FOR ALL TO authenticated USING (public.is_hr_admin()) WITH CHECK (public.is_hr_admin());

-- HR Documents: own + HR
CREATE POLICY hr_docs_select ON public.hr_documents FOR SELECT TO authenticated USING (
  public.is_hr_admin() OR employee_id = public.current_employee_id() OR public.is_manager_of(employee_id)
);
CREATE POLICY hr_docs_insert ON public.hr_documents FOR INSERT TO authenticated WITH CHECK (
  public.is_hr_admin() OR employee_id = public.current_employee_id()
);
CREATE POLICY hr_docs_delete ON public.hr_documents FOR DELETE TO authenticated USING (
  public.is_hr_admin() OR employee_id = public.current_employee_id()
);

-- ============================================================
-- STORAGE BUCKET (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-docs','hr-docs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY hr_storage_select ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'hr-docs' AND (
    public.is_hr_admin()
    OR (storage.foldername(name))[1] = public.current_employee_id()::text
  )
);
CREATE POLICY hr_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'hr-docs' AND (
    public.is_hr_admin()
    OR (storage.foldername(name))[1] = public.current_employee_id()::text
  )
);
CREATE POLICY hr_storage_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'hr-docs' AND (
    public.is_hr_admin()
    OR (storage.foldername(name))[1] = public.current_employee_id()::text
  )
);
