-- Migration to create the jobs_search_view to support search by required skills, tags, and company name.
-- Using security_invoker = on to automatically respect RLS on underlying tables.
CREATE OR REPLACE VIEW public.jobs_search_view WITH (security_invoker = on) AS
SELECT 
  j.*,
  c.name AS company_name,
  array_to_string(j.required_skills, ' ') AS skills_text,
  array_to_string(j.tags, ' ') AS tags_text
FROM public.jobs j
LEFT JOIN public.companies c ON j.company_id = c.id;
