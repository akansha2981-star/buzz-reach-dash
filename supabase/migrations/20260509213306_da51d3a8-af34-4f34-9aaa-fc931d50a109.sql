
ALTER TABLE public.ceo_desk_requests
  ADD CONSTRAINT ceo_desk_requests_institute_fk
  FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE SET NULL;

ALTER TABLE public.ceo_desk_notes
  ADD CONSTRAINT ceo_desk_notes_request_fk
  FOREIGN KEY (request_id) REFERENCES public.ceo_desk_requests(id) ON DELETE CASCADE;
