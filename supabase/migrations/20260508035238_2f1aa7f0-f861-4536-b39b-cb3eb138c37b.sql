CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID REFERENCES public.institutes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_institute ON public.tasks(institute_id);
CREATE INDEX idx_tasks_status_due ON public.tasks(status, due_at);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;