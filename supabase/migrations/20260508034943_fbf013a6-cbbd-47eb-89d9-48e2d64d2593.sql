ALTER TABLE public.institutes REPLICA IDENTITY FULL;
ALTER TABLE public.outreach_activities REPLICA IDENTITY FULL;
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
ALTER TABLE public.outreach_stages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.institutes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_stages;