CREATE OR REPLACE FUNCTION public.has_outreach_access(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_uid,'admin') OR EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id=_uid AND (p.can_dashboard OR p.can_colleges OR p.can_coaching OR p.can_meetings OR p.can_stages OR p.can_tasks OR p.can_documents OR p.can_timeline OR p.can_ceo_desk))
$$;
CREATE OR REPLACE FUNCTION public.has_documents_access(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_uid,'admin') OR EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id=_uid AND (p.can_documents OR p.can_colleges OR p.can_coaching))
$$;

ALTER TABLE public.tasks ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.meetings ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.outreach_activities ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.institute_documents ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.institute_links ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.institutes ALTER COLUMN created_by SET DEFAULT auth.uid();

-- institutes + child tables
DO $$ DECLARE t text; p text; BEGIN
  FOREACH t IN ARRAY ARRAY['institutes:inst','institute_emails:emails','institute_phones:phones','outreach_stages:stages'] LOOP
    p := split_part(t,':',2); t := split_part(t,':',1);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_outreach_access(auth.uid()))', p||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_outreach_access(auth.uid()))', p||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_outreach_access(auth.uid())) WITH CHECK (public.has_outreach_access(auth.uid()))', p||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_outreach_access(auth.uid()))', p||'_delete', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['institute_documents:docs','institute_links:links'] LOOP
    p := split_part(t,':',2); t := split_part(t,':',1);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_documents_access(auth.uid()) OR created_by = auth.uid())', p||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_documents_access(auth.uid()) AND (created_by IS NULL OR created_by = auth.uid()))', p||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),''admin'') OR (created_by = auth.uid() AND public.has_documents_access(auth.uid()))) WITH CHECK (public.has_role(auth.uid(),''admin'') OR (created_by = auth.uid() AND public.has_documents_access(auth.uid())))', p||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin'') OR (created_by = auth.uid() AND public.has_documents_access(auth.uid())))', p||'_delete', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_outreach_access(auth.uid()));

DROP POLICY IF EXISTS activities_insert ON public.outreach_activities;
CREATE POLICY activities_insert ON public.outreach_activities FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.has_outreach_access(auth.uid()));

DROP POLICY IF EXISTS meetings_insert_auth ON public.meetings;
CREATE POLICY meetings_insert_auth ON public.meetings FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = auth.uid() AND (p.can_meetings OR p.can_dashboard))));

DROP POLICY IF EXISTS hr_ann_select ON public.hr_announcements;
CREATE POLICY hr_ann_select ON public.hr_announcements FOR SELECT TO authenticated USING (public.is_hr_admin() OR public.current_employee_id() IS NOT NULL);

DROP POLICY IF EXISTS institute_docs_insert ON storage.objects;
DROP POLICY IF EXISTS institute_docs_update ON storage.objects;
DROP POLICY IF EXISTS institute_docs_delete ON storage.objects;
CREATE POLICY institute_docs_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'institute-docs' AND public.has_documents_access(auth.uid()));
CREATE POLICY institute_docs_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'institute-docs' AND (public.has_role(auth.uid(),'admin') OR owner_id = (SELECT auth.uid()::text))) WITH CHECK (bucket_id = 'institute-docs' AND (public.has_role(auth.uid(),'admin') OR owner_id = (SELECT auth.uid()::text)));
CREATE POLICY institute_docs_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'institute-docs' AND (public.has_role(auth.uid(),'admin') OR owner_id = (SELECT auth.uid()::text)));