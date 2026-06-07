-- jobs_experience_level_schema_fix.sql
-- Add the missing experience_level column to the jobs table safely.

BEGIN;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'Mid';

-- Adding a check constraint based on the exact values used in PostJobModal.jsx:
-- Junior, Mid, Senior, Specialist.
-- Also including Entry Level and Expert for future flexibility as mentioned by user.

ALTER TABLE public.jobs
ADD CONSTRAINT jobs_experience_level_check 
CHECK (experience_level IN ('Entry Level', 'Junior', 'Mid', 'Senior', 'Specialist', 'Expert'));

COMMIT;
