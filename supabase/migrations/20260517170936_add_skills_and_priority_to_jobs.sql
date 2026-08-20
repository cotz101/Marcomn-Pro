ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS required_skills text[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS priority boolean DEFAULT false;;
