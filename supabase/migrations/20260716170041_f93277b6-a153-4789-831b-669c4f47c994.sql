
-- Extend me_habits
ALTER TABLE public.me_habits
  ADD COLUMN IF NOT EXISTS icon text DEFAULT '✨',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS start_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS reminder_times text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS custom_days int[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Extend me_habit_logs
ALTER TABLE public.me_habit_logs
  ADD COLUMN IF NOT EXISTS values jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS me_habit_logs_habit_date_uidx
  ON public.me_habit_logs (habit_id, log_date);

-- New table: custom tracking fields per habit
CREATE TABLE IF NOT EXISTS public.me_habit_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  habit_id uuid NOT NULL REFERENCES public.me_habits(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL,
  unit text,
  target_value numeric,
  target_period text DEFAULT 'day',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.me_habit_fields TO authenticated;
GRANT ALL ON public.me_habit_fields TO service_role;

ALTER TABLE public.me_habit_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own habit fields"
  ON public.me_habit_fields
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated_at triggers
DROP TRIGGER IF EXISTS trg_me_habits_updated_at ON public.me_habits;
CREATE TRIGGER trg_me_habits_updated_at
  BEFORE UPDATE ON public.me_habits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_me_habit_logs_updated_at ON public.me_habit_logs;
CREATE TRIGGER trg_me_habit_logs_updated_at
  BEFORE UPDATE ON public.me_habit_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_me_habit_fields_updated_at ON public.me_habit_fields;
CREATE TRIGGER trg_me_habit_fields_updated_at
  BEFORE UPDATE ON public.me_habit_fields
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
