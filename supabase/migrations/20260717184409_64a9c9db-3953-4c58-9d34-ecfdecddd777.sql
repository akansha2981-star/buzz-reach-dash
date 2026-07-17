ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS priority smallint CHECK (priority BETWEEN 1 AND 5), ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_institutes_priority ON public.institutes(priority);
CREATE INDEX IF NOT EXISTS idx_institutes_sort_order ON public.institutes(sort_order);