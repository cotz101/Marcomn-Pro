-- ==============================================================================
-- Migration: 20260913100000_security_h1_additive_foundation.sql
-- Description: Security Hardening Batch H1 — Stage A: Additive Foundation
-- Scope:
--   1. SEC-T02: Group Post Authorization (drop permissive insert policy, enforce member-only)
--   2. SEC-T03: Candidate Reputation Canonical Calculation RPC (service_role only)
-- Note: Additive-first. Does NOT revoke legacy table writes to ensure zero-downtime compatibility.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEC-T02: Group Post Authorization
-- ------------------------------------------------------------------------------

-- Drop legacy permissive INSERT policy that allowed any authenticated user to post to any group
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.group_posts;

-- Ensure canonical policy 'Members can insert posts' is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'group_posts' 
      AND policyname = 'Members can insert posts'
  ) THEN
    CREATE POLICY "Members can insert posts"
      ON public.group_posts
      FOR INSERT
      WITH CHECK (
        (get_user_role(group_id) = ANY (ARRAY['member'::text, 'moderator'::text, 'admin'::text])) 
        AND (auth.uid() = user_id)
      );
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. SEC-T03: Candidate Reputation Canonical Calculation RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalculate_candidate_reputation(p_candidate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_completed_jobs INTEGER := 0;
  v_cancelled_jobs INTEGER := 0;
  v_total_considered INTEGER := 0;
  v_completion_rate NUMERIC := 0;
  v_feedback_count INTEGER := 0;
  v_positive_count INTEGER := 0;
  v_negative_count INTEGER := 0;
  v_summary public.candidate_reputation_summary%ROWTYPE;
BEGIN
  IF p_candidate_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Candidate ID is required');
  END IF;

  -- 1. Completed jobs count strictly from job_orders
  SELECT count(*) INTO v_completed_jobs
  FROM public.job_orders
  WHERE candidate_id = p_candidate_id
    AND status = 'Completed';

  -- 2. Candidate cancelled jobs count strictly from job_orders
  SELECT count(*) INTO v_cancelled_jobs
  FROM public.job_orders
  WHERE candidate_id = p_candidate_id
    AND status = 'Candidate Cancelled';

  -- 3. Completion rate calculation: completed / (completed + cancelled) * 100
  v_total_considered := v_completed_jobs + v_cancelled_jobs;
  IF v_total_considered > 0 THEN
    v_completion_rate := round((v_completed_jobs::numeric / v_total_considered::numeric) * 100);
  ELSE
    v_completion_rate := 0;
  END IF;

  -- 4. Feedback counts strictly from job_feedback
  SELECT
    count(*),
    count(*) FILTER (WHERE feedback_sentiment = 'positive'),
    count(*) FILTER (WHERE feedback_sentiment = 'negative')
  INTO
    v_feedback_count,
    v_positive_count,
    v_negative_count
  FROM public.job_feedback
  WHERE candidate_id = p_candidate_id;

  -- 5. Atomically upsert computed summary
  INSERT INTO public.candidate_reputation_summary (
    candidate_id,
    completed_jobs,
    cancelled_jobs,
    completion_rate,
    feedback_count,
    positive_feedback_count,
    negative_feedback_count,
    updated_at
  ) VALUES (
    p_candidate_id,
    v_completed_jobs,
    v_cancelled_jobs,
    v_completion_rate,
    v_feedback_count,
    v_positive_count,
    v_negative_count,
    now()
  )
  ON CONFLICT (candidate_id) DO UPDATE SET
    completed_jobs = EXCLUDED.completed_jobs,
    cancelled_jobs = EXCLUDED.cancelled_jobs,
    completion_rate = EXCLUDED.completion_rate,
    feedback_count = EXCLUDED.feedback_count,
    positive_feedback_count = EXCLUDED.positive_feedback_count,
    negative_feedback_count = EXCLUDED.negative_feedback_count,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_summary;

  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', v_summary.candidate_id,
    'completed_jobs', v_summary.completed_jobs,
    'cancelled_jobs', v_summary.cancelled_jobs,
    'completion_rate', v_summary.completion_rate,
    'feedback_count', v_summary.feedback_count,
    'positive_feedback_count', v_summary.positive_feedback_count,
    'negative_feedback_count', v_summary.negative_feedback_count,
    'updated_at', v_summary.updated_at
  );
END;
$$;

-- Revoke execute from PUBLIC, anon, and authenticated
REVOKE EXECUTE ON FUNCTION public.recalculate_candidate_reputation(UUID) FROM PUBLIC, anon, authenticated;

-- Grant execute exclusively to service_role (trusted server-side execution only)
GRANT EXECUTE ON FUNCTION public.recalculate_candidate_reputation(UUID) TO service_role;
