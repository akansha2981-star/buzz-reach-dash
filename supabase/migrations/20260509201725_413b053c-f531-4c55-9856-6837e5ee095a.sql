
ALTER TABLE public.institute_documents
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Others',
  ADD COLUMN IF NOT EXISTS name text,
  ALTER COLUMN institute_id DROP NOT NULL;

ALTER TABLE public.institute_links
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Others',
  ADD COLUMN IF NOT EXISTS name text,
  ALTER COLUMN institute_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_institute_documents_category ON public.institute_documents(category);
CREATE INDEX IF NOT EXISTS idx_institute_links_category ON public.institute_links(category);
