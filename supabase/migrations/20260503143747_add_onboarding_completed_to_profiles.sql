ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark existing real users as already onboarded (anyone with a real full_name set)
UPDATE public.profiles
  SET onboarding_completed = true
  WHERE full_name IS NOT NULL
    AND full_name != 'New Member';
;
