-- Migration: 20260912135000_sec_002_cancellation_completion_rpcs.sql
-- Description: SEC-002 Phase C3 Additive Cancellation, Completion RPCs & Identity Immutability
-- Scope: Additive RPCs and trigger only. No table-level permission revocation or policy drops in this stage.

-- 1. Candidate Cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_job_order_by_candidate(
  p_job_order_id UUID,
  p_reason TEXT,
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.job_orders%ROWTYPE;
  v_job public.jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_order
  FROM public.job_orders
  WHERE id = p_job_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Job order not found.');
  END IF;

  IF v_order.candidate_id <> v_actor THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: Only the candidate can cancel their engagement.');
  END IF;

  IF v_order.status <> 'Active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', format('Cannot cancel job order with status: %s', v_order.status));
  END IF;

  -- Fetch job details
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = v_order.job_id;

  -- 1. Insert cancellation record
  INSERT INTO public.job_cancellations (
    job_order_id,
    job_id,
    application_id,
    cancelled_by,
    cancelled_by_type,
    cancellation_reason,
    cancellation_remarks,
    created_at
  ) VALUES (
    v_order.id,
    v_order.job_id,
    v_order.application_id,
    v_actor,
    'candidate',
    p_reason,
    p_remarks,
    NOW()
  );

  -- 2. Update job_orders status
  UPDATE public.job_orders
  SET status = 'Candidate Cancelled', updated_at = NOW()
  WHERE id = v_order.id;

  -- 3. Update application status
  IF v_order.application_id IS NOT NULL THEN
    UPDATE public.applications
    SET status = 'Candidate Cancelled'
    WHERE id = v_order.application_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'application_id', v_order.application_id,
    'job_id', v_order.job_id,
    'poster_id', v_job.poster_id,
    'candidate_id', v_order.candidate_id,
    'job_title', v_job.title
  );
END;
$$;

ALTER FUNCTION public.cancel_job_order_by_candidate(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancel_job_order_by_candidate(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_job_order_by_candidate(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 2. Company Cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_job_order_by_company(
  p_job_order_id UUID,
  p_reason TEXT,
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.job_orders%ROWTYPE;
  v_job public.jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_order
  FROM public.job_orders
  WHERE id = p_job_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Job order not found.');
  END IF;

  IF NOT public.can_manage_job_recruitment(v_actor, v_order.job_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: You do not have permission to cancel this engagement.');
  END IF;

  IF v_order.status <> 'Active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', format('Cannot cancel job order with status: %s', v_order.status));
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = v_order.job_id;

  -- 1. Insert cancellation record
  INSERT INTO public.job_cancellations (
    job_order_id,
    job_id,
    application_id,
    cancelled_by,
    cancelled_by_type,
    cancellation_reason,
    cancellation_remarks,
    created_at
  ) VALUES (
    v_order.id,
    v_order.job_id,
    v_order.application_id,
    v_actor,
    'company',
    p_reason,
    p_remarks,
    NOW()
  );

  -- 2. Update job_orders status
  UPDATE public.job_orders
  SET status = 'Company Cancelled', updated_at = NOW()
  WHERE id = v_order.id;

  -- 3. Update application status
  IF v_order.application_id IS NOT NULL THEN
    UPDATE public.applications
    SET status = 'Company Cancelled'
    WHERE id = v_order.application_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'application_id', v_order.application_id,
    'job_id', v_order.job_id,
    'poster_id', v_job.poster_id,
    'candidate_id', v_order.candidate_id,
    'job_title', v_job.title
  );
END;
$$;

ALTER FUNCTION public.cancel_job_order_by_company(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancel_job_order_by_company(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_job_order_by_company(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 3. Canonical Direct/Legacy Completion RPC
CREATE OR REPLACE FUNCTION public.mark_job_order_completed(
  p_job_order_id UUID,
  p_sentiment TEXT,
  p_tags TEXT[] DEFAULT '{}',
  p_comment TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.job_orders%ROWTYPE;
  v_job public.jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_order
  FROM public.job_orders
  WHERE id = p_job_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Job order not found.');
  END IF;

  IF NOT public.can_manage_job_recruitment(v_actor, v_order.job_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: You do not have permission to complete this engagement.');
  END IF;

  IF v_order.status NOT IN ('Active', 'Payment Confirmed by Applicant', 'Work Completed by Applicant', 'Completion Confirmed by Company', 'Completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', format('Invalid status transition from: %s', v_order.status));
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = v_order.job_id;

  -- 1. Update job_orders
  UPDATE public.job_orders
  SET status = 'Completed', engagement_closed_at = NOW(), updated_at = NOW()
  WHERE id = v_order.id;

  -- 2. Update application
  IF v_order.application_id IS NOT NULL THEN
    UPDATE public.applications
    SET status = 'Completed'
    WHERE id = v_order.application_id;
  END IF;

  -- 3. Insert Feedback if sentiment provided
  IF p_sentiment IS NOT NULL AND p_sentiment <> '' THEN
    IF NOT EXISTS (SELECT 1 FROM public.job_feedback WHERE job_order_id = v_order.id) THEN
      INSERT INTO public.job_feedback (
        job_order_id, job_id, application_id, company_id, candidate_id,
        feedback_by, feedback_sentiment, feedback_tags, feedback_comment,
        feedback_context, created_at
      ) VALUES (
        v_order.id, v_order.job_id, v_order.application_id, v_order.company_id, v_order.candidate_id,
        v_actor, p_sentiment, p_tags, p_comment,
        'completed_job', NOW()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'application_id', v_order.application_id,
    'job_id', v_order.job_id,
    'candidate_id', v_order.candidate_id,
    'job_title', v_job.title
  );
END;
$$;

ALTER FUNCTION public.mark_job_order_completed(UUID, TEXT, TEXT[], TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_job_order_completed(UUID, TEXT, TEXT[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_job_order_completed(UUID, TEXT, TEXT[], TEXT) TO authenticated, service_role;

-- 4. Identity Immutability Defensive Trigger
CREATE OR REPLACE FUNCTION public.trg_applications_identity_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.job_id <> OLD.job_id THEN
    RAISE EXCEPTION 'Identity violation: applications.job_id is immutable.';
  END IF;
  IF NEW.applicant_id <> OLD.applicant_id THEN
    RAISE EXCEPTION 'Identity violation: applications.applicant_id is immutable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applications_identity_immutable ON public.applications;
CREATE TRIGGER trg_applications_identity_immutable
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.trg_applications_identity_immutable();
