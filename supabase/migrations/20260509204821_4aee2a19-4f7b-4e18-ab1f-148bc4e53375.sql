
ALTER TABLE public.hr_announcements REPLICA IDENTITY FULL;
ALTER TABLE public.hr_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.hr_leave_requests REPLICA IDENTITY FULL;
ALTER TABLE public.hr_attendance REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_announcements; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_leave_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_attendance; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
