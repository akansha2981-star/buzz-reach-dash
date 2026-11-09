ALTER TABLE public.lms_leads ADD COLUMN IF NOT EXISTS generated_at timestamptz;
CREATE INDEX IF NOT EXISTS lms_leads_generated_at_idx ON public.lms_leads (generated_at);

CREATE OR REPLACE FUNCTION public.lms_upsert_leads(rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  i int := 0;
  np text; ne text; existing_id uuid; gen timestamptz;
  result jsonb := '[]'::jsonb;
  n_ins int := 0; n_upd int := 0; n_merge int := 0;
  kind text;
BEGIN
  IF NOT public.has_lms_access(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(rows) LOOP
    np := public.lms_norm_phone(r->>'phone');
    ne := lower(btrim(COALESCE(r->>'email', '')));
    gen := NULL;
    BEGIN gen := NULLIF(r->>'generated_at', '')::timestamptz; EXCEPTION WHEN others THEN gen := NULL; END;
    existing_id := NULL; kind := 'inserted';
    IF np <> '' AND ne <> '' THEN
      SELECT id INTO existing_id FROM public.lms_leads
       WHERE public.lms_norm_phone(phone) = np AND lower(btrim(COALESCE(email, ''))) = ne LIMIT 1;
      IF existing_id IS NOT NULL THEN kind := 'updated'; END IF;
    END IF;
    IF existing_id IS NULL AND np <> '' THEN
      SELECT id INTO existing_id FROM public.lms_leads
       WHERE public.lms_norm_phone(phone) = np
         AND (ne = '' OR lower(btrim(COALESCE(email, ''))) = '')
       ORDER BY created_at LIMIT 1;
      IF existing_id IS NOT NULL THEN kind := 'merged'; END IF;
    END IF;
    IF existing_id IS NULL AND ne <> '' THEN
      SELECT id INTO existing_id FROM public.lms_leads
       WHERE lower(btrim(COALESCE(email, ''))) = ne
         AND (np = '' OR public.lms_norm_phone(phone) = '')
       ORDER BY created_at LIMIT 1;
      IF existing_id IS NOT NULL THEN kind := 'merged'; END IF;
    END IF;

    IF existing_id IS NOT NULL THEN
      UPDATE public.lms_leads SET
        name = COALESCE(NULLIF(btrim(r->>'name'), ''), name),
        phone = CASE WHEN public.lms_norm_phone(phone) = '' THEN NULLIF(btrim(r->>'phone'), '') ELSE phone END,
        email = CASE WHEN COALESCE(btrim(email), '') = '' THEN NULLIF(btrim(r->>'email'), '') ELSE email END,
        source = COALESCE(NULLIF(btrim(r->>'source'), ''), source),
        year = COALESCE((r->>'year')::int, year),
        generated_at = CASE WHEN gen IS NULL THEN generated_at WHEN generated_at IS NULL THEN gen ELSE LEAST(generated_at, gen) END,
        updated_at = now()
      WHERE id = existing_id;
      IF kind = 'merged' THEN n_merge := n_merge + 1; ELSE n_upd := n_upd + 1; END IF;
    ELSE
      INSERT INTO public.lms_leads (name, phone, email, source, year, generated_at)
      VALUES (btrim(r->>'name'), NULLIF(btrim(r->>'phone'), ''), NULLIF(btrim(r->>'email'), ''),
              NULLIF(btrim(r->>'source'), ''), (r->>'year')::int, gen)
      RETURNING id INTO existing_id;
      n_ins := n_ins + 1;
    END IF;
    result := result || jsonb_build_object('i', i, 'id', existing_id, 'kind', kind);
    i := i + 1;
  END LOOP;
  RETURN jsonb_build_object('inserted', n_ins, 'updated', n_upd, 'merged', n_merge, 'rows', result);
END;
$$;
GRANT EXECUTE ON FUNCTION public.lms_upsert_leads(jsonb) TO authenticated;