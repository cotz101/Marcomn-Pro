-- Migration to fix job completion functions and resolve unassigned record issues

-- 1. Fix confirm_work_completed_by_company
CREATE OR REPLACE FUNCTION public.confirm_work_completed_by_company(
  p_job_order_id uuid,
  p_note text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_order RECORD;
  v_user_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_company_name text;
  v_company_logo text;
BEGIN
  -- 1. Get the job order and join with jobs to get poster_id and company_id
  SELECT jo.*, j.poster_id, j.company_id, j.title as job_title
  INTO v_job_order
  FROM job_orders jo
  JOIN jobs j ON jo.job_id = j.id
  WHERE jo.id = p_job_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Job order not found');
  END IF;

  -- 2. Verify authorization
  IF v_job_order.poster_id = v_user_id THEN
    v_is_authorized := true;
  ELSIF v_job_order.company_id IS NOT NULL THEN
    PERFORM 1 FROM company_members
    WHERE company_id = v_job_order.company_id
      AND profile_id = v_user_id;
    IF FOUND THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: only the job poster or an authorized company member can perform this action');
  END IF;

  -- 3. Validate status
  IF v_job_order.status != 'Work Completed by Applicant' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status transition. Current status: ' || v_job_order.status);
  END IF;

  -- 4. Update job_order
  UPDATE job_orders
  SET status = 'Completion Confirmed by Company',
      completion_confirmed_by_company_at = now(),
      company_completion_note = p_note,
      updated_at = now()
  WHERE id = p_job_order_id;

  -- 5. Get company or poster name for notification
  IF v_job_order.company_id IS NOT NULL THEN
    SELECT name, logo_url INTO v_company_name, v_company_logo FROM companies WHERE id = v_job_order.company_id;
  END IF;

  IF v_company_name IS NULL THEN
    SELECT name, avatar_url INTO v_company_name, v_company_logo FROM profiles WHERE id = v_job_order.poster_id;
  END IF;

  -- Explicit checks instead of Postgres runtime exceptions
  IF v_company_name IS NULL THEN
    v_company_name := 'Company';
  END IF;

  RETURN json_build_object(
    'success', true,
    'candidate_id', v_job_order.candidate_id,
    'job_id', v_job_order.job_id,
    'job_title', v_job_order.job_title,
    'company_id', v_job_order.company_id,
    'company_name', v_company_name,
    'company_logo_url', v_company_logo
  );
END;
$$;

-- 2. Fix close_completed_engagement_by_company
CREATE OR REPLACE FUNCTION public.close_completed_engagement_by_company(
  p_job_order_id uuid,
  p_sentiment text,
  p_tags text[],
  p_comment text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_order RECORD;
  v_user_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_company_name text;
  v_company_logo text;
BEGIN
  -- 1. Get the job order
  SELECT jo.*, j.poster_id, j.company_id, j.title as job_title
  INTO v_job_order
  FROM job_orders jo
  JOIN jobs j ON jo.job_id = j.id
  WHERE jo.id = p_job_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Job order not found');
  END IF;

  -- 2. Verify authorization
  IF v_job_order.poster_id = v_user_id THEN
    v_is_authorized := true;
  ELSIF v_job_order.company_id IS NOT NULL THEN
    PERFORM 1 FROM company_members
    WHERE company_id = v_job_order.company_id
      AND profile_id = v_user_id;
    IF FOUND THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: only the job poster or an authorized company member can perform this action');
  END IF;

  -- 3. Validate status
  IF v_job_order.status != 'Payment Confirmed by Applicant' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status transition. Current status: ' || v_job_order.status);
  END IF;

  -- 4. Update job_orders
  UPDATE job_orders
  SET status = 'Completed',
      engagement_closed_at = now(),
      updated_at = now()
  WHERE id = p_job_order_id;

  -- 5. Update application
  IF v_job_order.application_id IS NOT NULL THEN
    UPDATE applications
    SET status = 'Completed'
    WHERE id = v_job_order.application_id;
  END IF;

  -- 6. Insert Feedback if sentiment is provided and doesn't exist
  IF p_sentiment IS NOT NULL AND p_sentiment != '' THEN
    PERFORM 1 FROM job_feedback WHERE job_order_id = p_job_order_id;
    IF NOT FOUND THEN
      INSERT INTO job_feedback (
        job_order_id, job_id, application_id, company_id, candidate_id,
        feedback_by, feedback_sentiment, feedback_tags, feedback_comment,
        feedback_context, created_at
      )
      VALUES (
        p_job_order_id, v_job_order.job_id, v_job_order.application_id, v_job_order.company_id, v_job_order.candidate_id,
        v_user_id, p_sentiment, p_tags, p_comment,
        'completed_job', now()
      );
    END IF;
  END IF;

  -- 7. Get company or poster name for notification
  IF v_job_order.company_id IS NOT NULL THEN
    SELECT name, logo_url INTO v_company_name, v_company_logo FROM companies WHERE id = v_job_order.company_id;
  END IF;

  IF v_company_name IS NULL THEN
    SELECT name, avatar_url INTO v_company_name, v_company_logo FROM profiles WHERE id = v_job_order.poster_id;
  END IF;

  -- Explicit checks instead of Postgres runtime exceptions
  IF v_company_name IS NULL THEN
    v_company_name := 'Company';
  END IF;

  RETURN json_build_object(
    'success', true,
    'candidate_id', v_job_order.candidate_id,
    'job_id', v_job_order.job_id,
    'application_id', v_job_order.application_id,
    'company_id', v_job_order.company_id,
    'job_title', v_job_order.job_title,
    'company_name', v_company_name,
    'company_logo_url', v_company_logo
  );
END;
$$;
