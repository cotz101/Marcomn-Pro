-- Migration: 20260912140000_sec_002_applications_update_lockdown.sql
-- Description: SEC-002 Phase C3.1 Final Applications Least-Privilege & UPDATE Lockdown
-- Scope: Revoke generic applications UPDATE/destructive privileges and drop generic UPDATE RLS policies.
-- Prerequisite: Must be executed ONLY AFTER Layer B frontend/server code is deployed and verified.

-- 1. Applications Table Generic UPDATE & Destructive Privileges Revocation
-- Revoke all unneeded privileges from anon, PUBLIC, and authenticated
REVOKE ALL ON TABLE public.applications FROM anon, PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.applications FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.applications TO authenticated;

-- 2. Drop Dangerous Generic UPDATE RLS Policies
DROP POLICY IF EXISTS "Users can update their own applications" ON public.applications;
DROP POLICY IF EXISTS "Employers can update applications for their jobs" ON public.applications;
