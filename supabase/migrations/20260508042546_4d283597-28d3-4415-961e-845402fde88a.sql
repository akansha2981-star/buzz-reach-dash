
CREATE TABLE public.ceo_desk_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('task','meeting','other')),
  source_id UUID,
  institute_id UUID,
  title TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','in_review','closed')),
  ceo_notes TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  requester_id UUID,
  requester_email TEXT,
  handled_by UUID,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_desk_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ceo_desk_select" ON public.ceo_desk_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ceo_desk_insert" ON public.ceo_desk_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND requester_id = auth.uid());

CREATE POLICY "ceo_desk_update" ON public.ceo_desk_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR requester_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR requester_id = auth.uid());

CREATE POLICY "ceo_desk_delete" ON public.ceo_desk_requests
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ceo_desk_touch
  BEFORE UPDATE ON public.ceo_desk_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_ceo_desk_status ON public.ceo_desk_requests(status, created_at DESC);

CREATE TABLE public.ceo_desk_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.ceo_desk_requests(id) ON DELETE CASCADE,
  author_id UUID,
  author_email TEXT,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_desk_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ceo_notes_select" ON public.ceo_desk_notes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.ceo_desk_requests r WHERE r.id = request_id AND r.requester_id = auth.uid())
  );

CREATE POLICY "ceo_notes_insert" ON public.ceo_desk_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.ceo_desk_requests r WHERE r.id = request_id AND r.requester_id = auth.uid())
    )
  );

CREATE POLICY "ceo_notes_delete" ON public.ceo_desk_notes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR author_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.ceo_desk_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ceo_desk_notes;
