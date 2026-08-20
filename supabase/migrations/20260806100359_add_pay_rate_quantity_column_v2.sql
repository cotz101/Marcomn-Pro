DROP VIEW IF EXISTS public.jobs_search_view;

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pay_rate_quantity numeric;

CREATE VIEW public.jobs_search_view WITH (security_invoker = on) AS
SELECT 
  j.*,
  c.name AS company_name,
  array_to_string(j.required_skills, ' ') AS skills_text,
  array_to_string(j.tags, ' ') AS tags_text
FROM public.jobs j
LEFT JOIN public.companies c ON j.company_id = c.id;

CREATE OR REPLACE FUNCTION public.check_job_compensation_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('Published', 'Open') AND (
    NEW.salary_range IS DISTINCT FROM OLD.salary_range OR
    NEW.salary_numeric IS DISTINCT FROM OLD.salary_numeric OR
    NEW.pay_rate_quantity IS DISTINCT FROM OLD.pay_rate_quantity
  ) THEN
    RAISE EXCEPTION 'Compensation fields cannot be modified after a job has been published.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;;
