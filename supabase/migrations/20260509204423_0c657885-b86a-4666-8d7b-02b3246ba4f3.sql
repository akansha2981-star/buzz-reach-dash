-- ============= Work logs =============
CREATE TABLE public.hr_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  work_date date NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  summary text NOT NULL,
  accomplishments text,
  blockers text,
  mood text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
ALTER TABLE public.hr_work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_wlog_select ON public.hr_work_logs FOR SELECT TO authenticated
  USING (is_hr_admin() OR employee_id = current_employee_id() OR is_manager_of(employee_id));
CREATE POLICY hr_wlog_insert ON public.hr_work_logs FOR INSERT TO authenticated
  WITH CHECK (employee_id = current_employee_id() OR is_hr_admin());
CREATE POLICY hr_wlog_update ON public.hr_work_logs FOR UPDATE TO authenticated
  USING (employee_id = current_employee_id() OR is_hr_admin())
  WITH CHECK (employee_id = current_employee_id() OR is_hr_admin());
CREATE POLICY hr_wlog_delete ON public.hr_work_logs FOR DELETE TO authenticated
  USING (employee_id = current_employee_id() OR is_hr_admin());

CREATE TRIGGER hr_wlog_touch BEFORE UPDATE ON public.hr_work_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= Tasks =============
CREATE TYPE public.hr_task_status AS ENUM ('todo','in_progress','review','done','cancelled');
CREATE TYPE public.hr_task_priority AS ENUM ('low','medium','high','urgent');

CREATE TABLE public.hr_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to uuid NOT NULL,
  assigned_by uuid,
  status public.hr_task_status NOT NULL DEFAULT 'todo',
  priority public.hr_task_priority NOT NULL DEFAULT 'medium',
  due_date date,
  completed_at timestamptz,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_tasks_select ON public.hr_tasks FOR SELECT TO authenticated
  USING (is_hr_admin() OR assigned_to = current_employee_id() OR assigned_by = current_employee_id() OR is_manager_of(assigned_to));
CREATE POLICY hr_tasks_insert ON public.hr_tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (is_hr_admin() OR assigned_by = current_employee_id()));
CREATE POLICY hr_tasks_update ON public.hr_tasks FOR UPDATE TO authenticated
  USING (is_hr_admin() OR assigned_to = current_employee_id() OR assigned_by = current_employee_id())
  WITH CHECK (is_hr_admin() OR assigned_to = current_employee_id() OR assigned_by = current_employee_id());
CREATE POLICY hr_tasks_delete ON public.hr_tasks FOR DELETE TO authenticated
  USING (is_hr_admin() OR assigned_by = current_employee_id());

CREATE TRIGGER hr_tasks_touch BEFORE UPDATE ON public.hr_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_hr_tasks_assigned_to ON public.hr_tasks(assigned_to);
CREATE INDEX idx_hr_tasks_status ON public.hr_tasks(status);

-- ============= Announcements =============
CREATE TABLE public.hr_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_ann_select ON public.hr_announcements FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY hr_ann_modify ON public.hr_announcements FOR ALL TO authenticated
  USING (is_hr_admin()) WITH CHECK (is_hr_admin());

CREATE TRIGGER hr_ann_touch BEFORE UPDATE ON public.hr_announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.hr_announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.hr_announcements(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, employee_id)
);
ALTER TABLE public.hr_announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_annr_select ON public.hr_announcement_reads FOR SELECT TO authenticated
  USING (is_hr_admin() OR employee_id = current_employee_id());
CREATE POLICY hr_annr_insert ON public.hr_announcement_reads FOR INSERT TO authenticated
  WITH CHECK (employee_id = current_employee_id());