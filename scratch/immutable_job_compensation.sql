-- Migration to make compensation fields immutable once a job has been published
CREATE OR REPLACE FUNCTION public.check_job_compensation_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('Published', 'Open') AND (
    NEW.salary_range IS DISTINCT FROM OLD.salary_range OR
    NEW.salary_numeric IS DISTINCT FROM OLD.salary_numeric
  ) THEN
    RAISE EXCEPTION 'Compensation fields cannot be modified after a job has been published.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists to prevent duplicate execution
DROP TRIGGER IF EXISTS trg_check_job_compensation_immutable ON public.jobs;

CREATE TRIGGER trg_check_job_compensation_immutable
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.check_job_compensation_immutable();
