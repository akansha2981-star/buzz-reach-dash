
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid;

CREATE INDEX IF NOT EXISTS tasks_recurrence_parent_idx ON public.tasks(recurrence_parent_id);
