ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_tasks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_documents boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_my_workspace boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_ceo_desk boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_timeline boolean NOT NULL DEFAULT true;