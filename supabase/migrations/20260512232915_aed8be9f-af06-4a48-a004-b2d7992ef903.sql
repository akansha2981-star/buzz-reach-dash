-- Enums
DO $$ BEGIN CREATE TYPE me_task_status AS ENUM ('pending','in_progress','completed','delayed','overdue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE me_task_priority AS ENUM ('low','medium','high','urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE me_focus_type AS ENUM ('pomodoro','short_break','long_break','focus'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tasks
CREATE TABLE public.me_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status me_task_status NOT NULL DEFAULT 'pending',
  priority me_task_priority NOT NULL DEFAULT 'medium',
  due_date date,
  due_time time,
  reminder_at timestamptz,
  category text,
  tags text[] DEFAULT '{}'::text[],
  estimated_minutes int,
  completed_at timestamptz,
  recurrence_rule jsonb,
  recurrence_parent_id uuid,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX me_tasks_user_idx ON public.me_tasks(user_id);
CREATE INDEX me_tasks_due_idx ON public.me_tasks(user_id, due_date);
ALTER TABLE public.me_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_tasks_owner ON public.me_tasks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER me_tasks_touch BEFORE UPDATE ON public.me_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Subtasks
CREATE TABLE public.me_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.me_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX me_subtasks_task_idx ON public.me_subtasks(task_id);
ALTER TABLE public.me_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_subtasks_owner ON public.me_subtasks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Task notes
CREATE TABLE public.me_task_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.me_tasks(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX me_task_notes_task_idx ON public.me_task_notes(task_id);
ALTER TABLE public.me_task_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_task_notes_owner ON public.me_task_notes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Habits
CREATE TABLE public.me_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  target_per_week int NOT NULL DEFAULT 7,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.me_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_habits_owner ON public.me_habits FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.me_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  habit_id uuid NOT NULL REFERENCES public.me_habits(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  done boolean NOT NULL DEFAULT true,
  UNIQUE(habit_id, log_date)
);
CREATE INDEX me_habit_logs_user_date_idx ON public.me_habit_logs(user_id, log_date);
ALTER TABLE public.me_habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_habit_logs_owner ON public.me_habit_logs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Goals
CREATE TABLE public.me_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  target_date date,
  progress int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.me_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_goals_owner ON public.me_goals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Focus sessions
CREATE TABLE public.me_focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.me_tasks(id) ON DELETE SET NULL,
  type me_focus_type NOT NULL DEFAULT 'pomodoro',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false
);
CREATE INDEX me_focus_user_idx ON public.me_focus_sessions(user_id, started_at);
ALTER TABLE public.me_focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_focus_owner ON public.me_focus_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Badges
CREATE TABLE public.me_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);
ALTER TABLE public.me_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_badges_owner ON public.me_badges FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Notifications
CREATE TABLE public.me_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  task_id uuid REFERENCES public.me_tasks(id) ON DELETE CASCADE,
  scheduled_for timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX me_notif_user_idx ON public.me_notifications(user_id, read_at);
ALTER TABLE public.me_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY me_notif_owner ON public.me_notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.me_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.me_notifications;