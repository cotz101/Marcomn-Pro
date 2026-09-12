-- Migration: 20260912130000_sec_002_applications_lifecycle_rpcs.sql
-- Description: SEC-002 Applications Lifecycle RPC Foundation (Additive Database Layer)
-- Scope: Additive RPCs only. No generic applications UPDATE revocation or policy drops in this stage.

-- 1. Helper function: can_manage_job_recruitment
CREATE OR REPLACE FUNCTION public.can_manage_job_recruitment(
  p_actor_id UUID,
  p_job_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.jobs j
    LEFT JOIN public.company_members cm ON cm.company_id = j.company_id
    WHERE j.id = p_job_id
      AND (
        (j.company_id IS NULL AND j.poster_id = p_actor_id)
        OR (j.company_id IS NOT NULL AND (
             j.poster_id = p_actor_id 
             OR (cm.profile_id = p_actor_id AND cm.role IN ('Owner', 'Admin', 'Member'))
           ))
      )
  );
$$;

ALTER FUNCTION public.can_manage_job_recruitment(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_manage_job_recruitment(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_job_recruitment(UUID, UUID) TO authenticated, service_role;

-- 2. Upgraded Atomic accept_job_offer RPC
DROP FUNCTION IF EXISTS public.accept_job_offer(UUID);

CREATE OR REPLACE FUNCTION public.accept_job_offer(app_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_app public.applications%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_filled_count INT;
  v_num_positions INT;
  v_fee_enabled BOOLEAN := FALSE;
  v_fee_percent NUMERIC := 0;
  v_fee NUMERIC(12,2) := 0;
  v_wallet public.mcredit_wallets%ROWTYPE;
  v_new_balance NUMERIC(12,2);
  v_tx public.mcredit_transactions%ROWTYPE;
  v_tx_id UUID;
  v_order RECORD;
  v_order_id UUID;
BEGIN
  -- 1. Authentication
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  -- 2. Lock and Validate Application
  SELECT * INTO v_app
  FROM public.applications
  WHERE id = app_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'APPLICATION_NOT_FOUND', 'message', 'Application not found.');
  END IF;

  IF v_app.applicant_id <> v_actor THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: You can only accept your own job offers.');
  END IF;

  -- Fetch job details for capacity & compensation
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = v_app.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'JOB_NOT_FOUND', 'message', 'Associated job not found.');
  END IF;

  v_num_positions := COALESCE(v_job.number_of_positions, 1);

  -- Current filled count
  SELECT COUNT(*)::INT INTO v_filled_count
  FROM public.applications
  WHERE job_id = v_job.id AND status IN ('Accepted', 'Completed');

  -- 3. Check Idempotency for already Accepted status (NO AUTOMATIC ORPHAN REPAIR)
  IF v_app.status = 'Accepted' THEN
    SELECT * INTO v_order
    FROM public.job_orders
    WHERE application_id = v_app.id;

    IF FOUND THEN
      -- If order is in terminal state, do not alter
      IF v_order.status IN ('Completed', 'Candidate Cancelled', 'Company Cancelled') THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'ENGAGEMENT_TERMINATED',
          'message', format('Engagement has already ended with status: %s', v_order.status),
          'order_id', v_order.id,
          'order_status', v_order.status
        );
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'code', 'ALREADY_ACCEPTED',
        'message', 'Offer already accepted.',
        'application_id', v_app.id,
        'job_id', v_job.id,
        'order_id', v_order.id,
        'filled_count', v_filled_count,
        'num_positions', v_num_positions,
        'reached_cap', (v_filled_count >= v_num_positions),
        'status', 'Accepted'
      );
    ELSE
      -- Orphan Accepted application: DO NOT AUTO-REPAIR. Return integrity error.
      RETURN jsonb_build_object(
        'success', false,
        'error', 'ACCEPTED_WITHOUT_ENGAGEMENT',
        'message', 'Application is marked Accepted but has no corresponding engagement record. Manual audit required.',
        'application_id', v_app.id,
        'job_id', v_job.id
      );
    END IF;
  END IF;

  -- 4. Validate Offered Status
  IF v_app.status <> 'Offered' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INVALID_STATUS', 
      'message', format('Application is not in Offered status. Current status: %s', v_app.status)
    );
  END IF;

  -- 5. Expiry Check
  IF v_app.offer_expires_at IS NOT NULL AND NOW() > v_app.offer_expires_at THEN
    UPDATE public.applications
    SET status = 'Expired'
    WHERE id = v_app.id;

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'OFFER_EXPIRED', 
      'message', 'This job offer has expired.'
    );
  END IF;

  -- 6. Capacity Enforcement
  IF v_filled_count >= v_num_positions THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'CAPACITY_REACHED', 
      'message', 'All positions for this job are already filled.'
    );
  END IF;

  -- 7. MCredits Monetization & Fee Calculation
  SELECT 
    COALESCE((SELECT lower(trim(value)) = 'true' FROM public.platform_settings WHERE key = 'mcredit_candidate_acceptance_enabled'), true),
    COALESCE((SELECT nullif(trim(value), '')::numeric FROM public.platform_settings WHERE key = 'candidate_acceptance_fee_percent'), 5)
  INTO v_fee_enabled, v_fee_percent;

  IF v_fee_enabled AND v_fee_percent > 0 AND COALESCE(v_job.salary_numeric, 0) > 0 THEN
    v_fee := ROUND((v_job.salary_numeric * v_fee_percent / 100.0), 2);
  ELSE
    v_fee := 0;
  END IF;

  -- 8. Financial Processing & Debit Integrity Validation
  -- Check if any transaction already exists for this application reference
  SELECT * INTO v_tx
  FROM public.mcredit_transactions
  WHERE reference_type = 'job_application'
    AND reference_id = v_app.id;

  IF FOUND THEN
    -- If a transaction already exists while application is still 'Offered', this is an integrity conflict / partial legacy state.
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ACCEPTANCE_DEBIT_INTEGRITY_CONFLICT',
      'message', 'An existing financial transaction was found in conflict with application state. Manual audit required.',
      'application_id', v_app.id,
      'transaction_id', v_tx.id
    );
  END IF;

  -- If Fee > 0, derive candidate wallet and execute debit
  IF v_fee > 0 THEN
    -- Advisory lock on candidate personal wallet
    PERFORM pg_advisory_xact_lock(hashtextextended('user:' || v_actor::text, 0));

    SELECT * INTO v_wallet
    FROM public.mcredit_wallets
    WHERE owner_type = 'user' AND owner_id = v_actor
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.mcredit_wallets (owner_type, owner_id, balance, status)
      VALUES ('user', v_actor, 0.00, 'active')
      RETURNING * INTO v_wallet;
    END IF;

    IF v_wallet.status <> 'active' THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'WALLET_INACTIVE', 
        'message', 'Candidate wallet is not active.'
      );
    END IF;

    IF v_wallet.balance < v_fee THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_BALANCE',
        'message', format('Insufficient MCredits. Required: %s MC, Available: %s MC', v_fee, v_wallet.balance),
        'required', v_fee,
        'available', v_wallet.balance
      );
    END IF;

    v_new_balance := v_wallet.balance - v_fee;
    UPDATE public.mcredit_wallets
    SET balance = v_new_balance, updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO public.mcredit_transactions (
      wallet_id, transaction_type, direction, amount, balance_before, balance_after,
      reference_type, reference_id, description, justification_note, created_by, created_at
    ) VALUES (
      v_wallet.id, 'spend', 'debit', v_fee, v_wallet.balance, v_new_balance,
      'job_application', v_app.id,
      'Candidate job acceptance fee',
      format('Candidate acceptance fee (%s%% of %s) for job %s', v_fee_percent, v_job.salary_numeric, v_job.id),
      v_actor, NOW()
    ) RETURNING id INTO v_tx_id;
  END IF;

  -- 9. Update Application Status to Accepted
  UPDATE public.applications
  SET status = 'Accepted'
  WHERE id = v_app.id;

  -- 10. Insert Canonical job_orders Row
  INSERT INTO public.job_orders (
    job_id,
    application_id,
    company_id,
    candidate_id,
    status,
    accepted_at,
    created_at,
    updated_at
  ) VALUES (
    v_job.id,
    v_app.id,
    v_job.company_id,
    v_actor,
    'Active',
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- 11. Final Count & Capacity Calculation
  v_filled_count := v_filled_count + 1;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Offer accepted successfully',
    'application_id', v_app.id,
    'job_id', v_job.id,
    'order_id', v_order_id,
    'transaction_id', v_tx_id,
    'fee_charged', v_fee,
    'filled_count', v_filled_count,
    'num_positions', v_num_positions,
    'reached_cap', (v_filled_count >= v_num_positions),
    'status', 'Accepted'
  );
END;
$$;

ALTER FUNCTION public.accept_job_offer(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_job_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_job_offer(UUID) TO authenticated, service_role;

-- 3. Candidate Withdrawal RPC
CREATE OR REPLACE FUNCTION public.candidate_withdraw_application(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_app public.applications%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_new_count INT;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'APPLICATION_NOT_FOUND', 'message', 'Application not found.');
  END IF;

  IF v_app.applicant_id <> v_actor THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: You can only withdraw your own applications.');
  END IF;

  IF v_app.status NOT IN ('Pending', 'Under Review', 'Shortlisted', 'Offered') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INVALID_STATUS', 
      'message', format('Cannot withdraw application in %s status.', v_app.status)
    );
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = v_app.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'JOB_NOT_FOUND', 'message', 'Associated job not found.');
  END IF;

  v_new_count := COALESCE(v_app.withdrawal_count, 0) + 1;

  IF v_new_count > COALESCE(v_job.withdrawal_limit, 3) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'WITHDRAWAL_LIMIT_EXCEEDED', 
      'message', format('Withdrawal limit of %s reached for this job.', COALESCE(v_job.withdrawal_limit, 3))
    );
  END IF;

  UPDATE public.applications
  SET 
    status = 'Withdrawn',
    withdrawal_count = v_new_count
  WHERE id = v_app.id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app.id,
    'status', 'Withdrawn',
    'withdrawal_count', v_new_count
  );
END;
$$;

ALTER FUNCTION public.candidate_withdraw_application(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.candidate_withdraw_application(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_withdraw_application(UUID) TO authenticated, service_role;

-- 4. Candidate Reapply RPC
CREATE OR REPLACE FUNCTION public.candidate_reapply_application(
  p_application_id UUID,
  p_documents JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_app public.applications%ROWTYPE;
  v_job public.jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'APPLICATION_NOT_FOUND', 'message', 'Application not found.');
  END IF;

  IF v_app.applicant_id <> v_actor THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: You can only re-apply to your own applications.');
  END IF;

  IF v_app.status <> 'Withdrawn' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INVALID_STATUS', 
      'message', format('Only Withdrawn applications can be re-applied. Current status: %s', v_app.status)
    );
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = v_app.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'JOB_NOT_FOUND', 'message', 'Associated job not found.');
  END IF;

  IF v_job.status NOT IN ('Published', 'Open') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'JOB_NOT_OPEN', 
      'message', 'Job is no longer open for applications.'
    );
  END IF;

  IF COALESCE(v_app.withdrawal_count, 0) >= COALESCE(v_job.withdrawal_limit, 3) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'WITHDRAWAL_LIMIT_REACHED', 
      'message', 'Maximum withdrawal / reapplication limit reached for this job.'
    );
  END IF;

  UPDATE public.applications
  SET 
    status = 'Pending',
    applied_at = NOW(),
    documents = COALESCE(p_documents, documents)
  WHERE id = v_app.id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app.id,
    'status', 'Pending',
    'applied_at', NOW()
  );
END;
$$;

ALTER FUNCTION public.candidate_reapply_application(UUID, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.candidate_reapply_application(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_reapply_application(UUID, JSONB) TO authenticated, service_role;

-- 5. Employer Status Update RPC
CREATE OR REPLACE FUNCTION public.employer_update_application_status(
  p_application_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_app public.applications%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF p_new_status NOT IN ('Under Review', 'Shortlisted', 'Rejected') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INVALID_TARGET_STATUS', 
      'message', 'Invalid status. Permitted status transitions are: Under Review, Shortlisted, Rejected.'
    );
  END IF;

  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'APPLICATION_NOT_FOUND', 'message', 'Application not found.');
  END IF;

  IF NOT public.can_manage_job_recruitment(v_actor, v_app.job_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: You do not have permission to manage recruitment for this job.');
  END IF;

  IF v_app.status IN ('Accepted', 'Completed', 'Candidate Cancelled', 'Company Cancelled', 'Withdrawn', 'Closed') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INVALID_CURRENT_STATUS', 
      'message', format('Cannot update application in %s status.', v_app.status)
    );
  END IF;

  UPDATE public.applications
  SET status = p_new_status
  WHERE id = v_app.id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app.id,
    'status', p_new_status
  );
END;
$$;

ALTER FUNCTION public.employer_update_application_status(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.employer_update_application_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employer_update_application_status(UUID, TEXT) TO authenticated, service_role;

-- 6. Employer Send Job Offer RPC
CREATE OR REPLACE FUNCTION public.employer_send_job_offer(
  p_application_id UUID,
  p_expiry_hours INT DEFAULT 72
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_app public.applications%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_filled_count INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF p_expiry_hours < 1 OR p_expiry_hours > 720 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_EXPIRY', 'message', 'Expiry hours must be between 1 and 720 (30 days).');
  END IF;

  SELECT * INTO v_app
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'APPLICATION_NOT_FOUND', 'message', 'Application not found.');
  END IF;

  IF NOT public.can_manage_job_recruitment(v_actor, v_app.job_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: You do not have permission to send offers for this job.');
  END IF;

  IF v_app.status NOT IN ('Pending', 'Under Review', 'Shortlisted') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'INVALID_STATUS', 
      'message', format('Offers can only be sent to applications in Pending, Under Review, or Shortlisted status. Current: %s', v_app.status)
    );
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = v_app.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'JOB_NOT_FOUND', 'message', 'Associated job not found.');
  END IF;

  SELECT COUNT(*)::INT INTO v_filled_count
  FROM public.applications
  WHERE job_id = v_job.id AND status IN ('Accepted', 'Completed');

  IF v_filled_count >= COALESCE(v_job.number_of_positions, 1) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'CAPACITY_REACHED', 
      'message', 'All positions for this job are already filled.'
    );
  END IF;

  v_expires_at := NOW() + (p_expiry_hours * INTERVAL '1 hour');

  UPDATE public.applications
  SET 
    status = 'Offered',
    offer_sent_at = NOW(),
    offer_expiry_hours = p_expiry_hours,
    offer_expires_at = v_expires_at
  WHERE id = v_app.id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_app.id,
    'status', 'Offered',
    'offer_sent_at', NOW(),
    'offer_expiry_hours', p_expiry_hours,
    'offer_expires_at', v_expires_at
  );
END;
$$;

ALTER FUNCTION public.employer_send_job_offer(UUID, INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.employer_send_job_offer(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employer_send_job_offer(UUID, INT) TO authenticated, service_role;

-- 7. Employer Close Job Posting RPC
CREATE OR REPLACE FUNCTION public.employer_close_job_posting(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.jobs%ROWTYPE;
  v_updated_apps_count INT := 0;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'JOB_NOT_FOUND', 'message', 'Job not found.');
  END IF;

  IF NOT public.can_manage_job_recruitment(v_actor, v_job.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized: You do not have permission to close this job.');
  END IF;

  -- 1. Close Job Posting
  UPDATE public.jobs
  SET 
    status = 'Closed'
  WHERE id = v_job.id;

  -- 2. Update remaining non-engaged applications to Closed
  WITH updated AS (
    UPDATE public.applications
    SET status = 'Closed'
    WHERE job_id = v_job.id
      AND status NOT IN ('Accepted', 'Completed', 'Candidate Cancelled', 'Company Cancelled', 'Withdrawn', 'Closed')
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_updated_apps_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job.id,
    'status', 'Closed',
    'closed_applications_count', v_updated_apps_count
  );
END;
$$;

ALTER FUNCTION public.employer_close_job_posting(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.employer_close_job_posting(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employer_close_job_posting(UUID) TO authenticated, service_role;
