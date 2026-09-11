-- Migration: 20260912120000_sec_001_public_profiles_view.sql
-- Description: SEC-001 Stage 1: Expose public.public_profiles view containing strictly the 17 approved public professional fields.
-- This migration is purely additive and non-breaking: it does NOT modify public.profiles RLS policies,
-- allowing existing and updated frontends to operate concurrently during rollout.

BEGIN;

-- 1. Create public.public_profiles view with the 17 authoritative public fields
-- Created with default security definer behavior owned by postgres, with security_barrier = true
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true) AS
SELECT
  id,
  username,
  name,
  avatar_url,
  headline,
  "currentRole",
  current_company,
  "previousRole",
  "yearsExperience",
  skills,
  location,
  bio,
  about,
  website,
  cover_photo_url,
  "isSailing",
  "openToWork"
FROM public.profiles;

ALTER VIEW public.public_profiles OWNER TO postgres;

-- 2. Grant read access on the public view
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

COMMIT;
