-- ==============================================================================
-- Migration: 20260913101000_security_h1_reputation_lockdown.sql
-- Description: Security Hardening Batch H1 — Stage C: Candidate Reputation Mutation Lockdown
-- Scope:
--   1. Revoke direct mutation privileges on candidate_reputation_summary from anon, authenticated, and PUBLIC
--   2. Drop open mutation policy 'System can manage reputation'
--   3. Ensure public SELECT policy is strictly maintained
-- ==============================================================================

-- 1. Revoke direct mutation privileges on candidate_reputation_summary from anon, authenticated, and PUBLIC
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.candidate_reputation_summary FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.candidate_reputation_summary TO anon, authenticated, service_role;

-- 2. Drop unsafe open mutation policy
DROP POLICY IF EXISTS "System can manage reputation" ON public.candidate_reputation_summary;

-- 3. Ensure public SELECT policy is strictly maintained
DROP POLICY IF EXISTS "Anyone can view reputation" ON public.candidate_reputation_summary;
CREATE POLICY "Anyone can view reputation"
  ON public.candidate_reputation_summary 
  FOR SELECT 
  USING (true);
