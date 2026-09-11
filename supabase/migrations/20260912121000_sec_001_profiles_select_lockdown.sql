-- Migration: 20260912121000_sec_001_profiles_select_lockdown.sql
-- Description: SEC-001 Stage 2: Restrict public.profiles SELECT to owner and platform admins.
-- This migration is executed AFTER all frontend clients have been updated to query public.public_profiles.

BEGIN;

-- 1. Drop permissive SELECT policies on public.profiles
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by owner and platform admins" ON public.profiles;

-- 2. Enforce strict Owner and Platform Admin SELECT policy
CREATE POLICY "Profiles viewable by owner and platform admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = id
  OR public.current_user_has_platform_admin_access()
  OR public.is_admin_user((SELECT auth.uid()))
);

COMMIT;
