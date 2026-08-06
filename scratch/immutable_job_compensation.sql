-- Migration to make compensation fields immutable once a job has been published
-- 1. Add pay_rate_quantity column if it doesn't exist
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pay_rate_quantity numeric;

-- 2. Update the compensation immutability trigger function
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
$$ LANGUAGE plpgsql;

-- 3. Re-create the trigger
DROP TRIGGER IF EXISTS trg_check_job_compensation_immutable ON public.jobs;

CREATE TRIGGER trg_check_job_compensation_immutable
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.check_job_compensation_immutable();
