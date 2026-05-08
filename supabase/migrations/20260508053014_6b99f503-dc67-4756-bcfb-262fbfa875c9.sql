
CREATE TABLE public.institute_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.institute_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "links_select" ON public.institute_links FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "links_insert" ON public.institute_links FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "links_update" ON public.institute_links FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "links_delete" ON public.institute_links FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TABLE public.institute_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institute_id uuid NOT NULL,
  label text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.institute_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select" ON public.institute_documents FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "docs_insert" ON public.institute_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "docs_update" ON public.institute_documents FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "docs_delete" ON public.institute_documents FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO storage.buckets (id, name, public) VALUES ('institute-docs', 'institute-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "institute_docs_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'institute-docs');
CREATE POLICY "institute_docs_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'institute-docs');
CREATE POLICY "institute_docs_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'institute-docs');
CREATE POLICY "institute_docs_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'institute-docs');
