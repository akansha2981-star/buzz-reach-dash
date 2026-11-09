CREATE OR REPLACE FUNCTION public.lms_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.lms_leads),
    'by_year', (SELECT COALESCE(jsonb_object_agg(year, n), '{}'::jsonb) FROM (SELECT year, count(*) AS n FROM public.lms_leads GROUP BY year) t),
    'by_source', (SELECT COALESCE(jsonb_object_agg(src, n), '{}'::jsonb) FROM (SELECT COALESCE(NULLIF(btrim(source), ''), 'Unspecified') AS src, count(*) AS n FROM public.lms_leads GROUP BY 1) t),
    'by_tag', (SELECT COALESCE(jsonb_agg(jsonb_build_object('tag', name, 'category', cat, 'color', color, 'count', n) ORDER BY n DESC), '[]'::jsonb) FROM (SELECT t2.name, c.name AS cat, c.color, count(*) AS n FROM public.lms_lead_tags lt JOIN public.lms_tags t2 ON t2.id = lt.tag_id JOIN public.lms_tag_categories c ON c.id = t2.category_id GROUP BY t2.name, c.name, c.color) t),
    'by_day', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'count', n) ORDER BY d), '[]'::jsonb) FROM (SELECT created_at::date AS d, count(*) AS n FROM public.lms_leads WHERE created_at >= now() - interval '180 days' GROUP BY 1) t),
    'first_day', (SELECT min(created_at::date) FROM public.lms_leads),
    'last_7', (SELECT count(*) FROM public.lms_leads WHERE created_at >= now() - interval '7 days'),
    'last_30', (SELECT count(*) FROM public.lms_leads WHERE created_at >= now() - interval '30 days')
  )
  WHERE public.has_lms_access(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.lms_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.lms_find_duplicate_pairs(pairs jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH input AS (
    SELECT DISTINCT lower(btrim(p->>'email')) AS email,
           regexp_replace(COALESCE(p->>'phone', ''), '\D', '', 'g') AS phone
    FROM jsonb_array_elements(pairs) AS p
  ),
  normed AS (
    SELECT email,
           CASE WHEN phone ~ '^(91|0)\d{10}$' THEN right(phone, 10) ELSE phone END AS phone
    FROM input
  ),
  leads AS (
    SELECT lower(btrim(email)) AS email,
           CASE WHEN regexp_replace(COALESCE(phone, ''), '\D', '', 'g') ~ '^(91|0)\d{10}$'
                THEN right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10)
                ELSE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') END AS phone
    FROM public.lms_leads
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('email', n.email, 'phone', n.phone)), '[]'::jsonb)
  FROM normed n
  WHERE public.has_lms_access(auth.uid())
    AND n.email <> '' AND n.phone <> ''
    AND EXISTS (SELECT 1 FROM leads l WHERE l.email = n.email AND l.phone = n.phone);
$$;

GRANT EXECUTE ON FUNCTION public.lms_find_duplicate_pairs(jsonb) TO authenticated;