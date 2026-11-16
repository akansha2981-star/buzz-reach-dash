ALTER TABLE public.accounts_expenses ADD COLUMN IF NOT EXISTS gst_paid numeric NOT NULL DEFAULT 0;
CREATE POLICY "accounts docs select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'accounts-docs' AND public.has_accounts_access(auth.uid()));
CREATE POLICY "accounts docs insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'accounts-docs' AND public.has_accounts_access(auth.uid()));
CREATE POLICY "accounts docs update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'accounts-docs' AND public.has_accounts_access(auth.uid()));
CREATE POLICY "accounts docs delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'accounts-docs' AND public.has_accounts_access(auth.uid()));