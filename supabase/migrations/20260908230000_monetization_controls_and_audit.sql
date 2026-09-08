-- Migration: 20260908230000_monetization_controls_and_audit.sql
-- Description: Add MCredits monetization controls (job posting and candidate acceptance) and audit trail.

-- 1. Seed authoritative platform settings
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES
  ('mcredit_job_posting_enabled', 'true', now()),
  ('mcredit_candidate_acceptance_enabled', 'true', now())
ON CONFLICT (key) DO NOTHING;

-- 2. Create append-only platform_setting_audit_logs table
CREATE TABLE IF NOT EXISTS public.platform_setting_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  previous_value text,
  new_value text NOT NULL,
  reason_code text NOT NULL,
  reason_label text NOT NULL,
  additional_details text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  actor_email text,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_setting_audit_logs_key_created
  ON public.platform_setting_audit_logs(setting_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_setting_audit_logs_created
  ON public.platform_setting_audit_logs(created_at DESC);

ALTER TABLE public.platform_setting_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Read-only for authorized platform admins
DROP POLICY IF EXISTS "Platform admins can view setting audit logs" ON public.platform_setting_audit_logs;
CREATE POLICY "Platform admins can view setting audit logs"
  ON public.platform_setting_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_has_platform_admin_access()
    OR public.has_admin_permission(auth.uid(), 'can_manage_global_settings')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.platform_setting_audit_logs FROM anon, authenticated;

-- 4. Security Definer RPC for updating monetization settings with audit logging
CREATE OR REPLACE FUNCTION public.update_monetization_setting(
  p_key text,
  p_value text,
  p_reason_code text,
  p_reason_label text DEFAULT NULL,
  p_additional_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_clean_key text := lower(trim(p_key));
  v_clean_val text := lower(trim(p_value));
  v_clean_code text := lower(trim(p_reason_code));
  v_clean_details text := nullif(trim(p_additional_details), '');
  v_canonical_label text;
  v_setting_row record;
  v_prev_value text;
  v_actor_email text;
  v_actor_name text;
  v_actor_role text := 'admin';
  v_log_id uuid;
BEGIN
  -- 1. Authentication check
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
  END IF;

  -- 2. Authorization check (Platform Admin or Global Settings permission)
  SELECT (
    public.current_user_has_platform_admin_access()
    OR public.has_admin_permission(v_actor_id, 'can_manage_global_settings')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = v_actor_id
        AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
    )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Platform admin permissions required');
  END IF;

  -- 3. Key validation
  IF v_clean_key NOT IN ('mcredit_job_posting_enabled', 'mcredit_candidate_acceptance_enabled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid monetization setting key: ' || coalesce(p_key, 'null'));
  END IF;

  -- 4. Value validation (must be 'true' or 'false')
  IF v_clean_val NOT IN ('true', 'false') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Value must be boolean string ("true" or "false")');
  END IF;

  -- 5. Canonical Reason Mapping (server-authoritative)
  CASE v_clean_code
    WHEN 'uat_internal_testing' THEN v_canonical_label := 'UAT / Internal Testing';
    WHEN 'promotional_period' THEN v_canonical_label := 'Promotional Period';
    WHEN 'temporary_fee_waiver' THEN v_canonical_label := 'Temporary Fee Waiver';
    WHEN 'management_decision' THEN v_canonical_label := 'Management Decision';
    WHEN 'maintenance_technical_issue' THEN v_canonical_label := 'Maintenance / Technical Issue';
    WHEN 'commercial_pricing_transition' THEN v_canonical_label := 'Commercial / Pricing Transition';
    WHEN 'other' THEN v_canonical_label := 'Other';
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid reason code: ' || coalesce(p_reason_code, 'null') || '. Must be one of: uat_internal_testing, promotional_period, temporary_fee_waiver, management_decision, maintenance_technical_issue, commercial_pricing_transition, other'
      );
  END CASE;

  -- If 'other', additional notes are mandatory
  IF v_clean_code = 'other' AND v_clean_details IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Additional details are required when selecting "Other"');
  END IF;

  -- 6. Lock current setting row for update to ensure concurrency safety
  SELECT id, value INTO v_setting_row
  FROM public.platform_settings
  WHERE key = v_clean_key
  FOR UPDATE;

  IF NOT FOUND THEN
    -- If row didn't exist yet, insert with default 'true' before locking
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES (v_clean_key, 'true', now())
    ON CONFLICT (key) DO NOTHING;

    SELECT id, value INTO v_setting_row
    FROM public.platform_settings
    WHERE key = v_clean_key
    FOR UPDATE;
  END IF;

  v_prev_value := lower(trim(coalesce(v_setting_row.value, 'true')));

  -- 7. Reject No-Op Changes
  IF v_clean_val = v_prev_value THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'no_change',
      'setting_key', v_clean_key,
      'current_value', v_prev_value,
      'message', 'Setting value unchanged; no update performed and no audit record created.'
    );
  END IF;

  -- 8. Snapshot actor details
  SELECT email INTO v_actor_email
  FROM auth.users
  WHERE id = v_actor_id;

  SELECT coalesce(name, username, 'Admin User') INTO v_actor_name
  FROM public.profiles
  WHERE id = v_actor_id;

  -- Try to get primary role
  SELECT r.role_name INTO v_actor_role
  FROM public.platform_admin_user_roles ur
  JOIN public.platform_admin_roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_actor_id AND ur.is_active = true
  ORDER BY ur.created_at ASC
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    SELECT global_role::text INTO v_actor_role
    FROM public.profiles
    WHERE id = v_actor_id;
  END IF;

  IF v_actor_role IS NULL THEN
    v_actor_role := 'platform_admin';
  END IF;

  -- 9. Update platform setting atomically
  UPDATE public.platform_settings
  SET
    value = v_clean_val,
    updated_by = v_actor_id,
    updated_at = now()
  WHERE key = v_clean_key;

  -- 10. Insert audit log record with canonical label and snapshot
  INSERT INTO public.platform_setting_audit_logs (
    setting_key,
    previous_value,
    new_value,
    reason_code,
    reason_label,
    additional_details,
    actor_user_id,
    actor_name,
    actor_email,
    actor_role,
    created_at
  ) VALUES (
    v_clean_key,
    v_prev_value,
    v_clean_val,
    v_clean_code,
    v_canonical_label,
    v_clean_details,
    v_actor_id,
    v_actor_name,
    v_actor_email,
    v_actor_role,
    now()
  ) RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'updated',
    'setting_key', v_clean_key,
    'previous_value', v_prev_value,
    'new_value', v_clean_val,
    'audit_log_id', v_log_id
  );
END;
$$;

create or replace function public.publish_job_with_mcredit(
  p_job_id uuid,
  p_expected_fee numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_posting_enabled boolean := true;
  v_fee_percent numeric;
  v_fee numeric(12,2);
  v_owner_type text;
  v_owner_id uuid;
  v_wallet public.mcredit_wallets%rowtype;
  v_transaction public.mcredit_transactions%rowtype;
  v_transaction_id uuid;
  v_new_balance numeric(12,2);
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'code', 'unauthenticated');
  end if;

  select * into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'job_not_found');
  end if;

  if v_job.company_id is null then
    if v_job.poster_id <> v_actor then
      return jsonb_build_object('success', false, 'code', 'unauthorized');
    end if;
    v_owner_type := 'user';
    v_owner_id := v_actor;
  else
    if not exists (
      select 1
      from public.company_members cm
      where cm.company_id = v_job.company_id
        and cm.profile_id = v_actor
        and cm.role in ('Owner', 'Admin', 'Member')
    ) then
      return jsonb_build_object('success', false, 'code', 'unauthorized');
    end if;
    v_owner_type := 'company';
    v_owner_id := v_job.company_id;
  end if;

  select t.id into v_transaction_id
  from public.mcredit_transactions t
  where t.reference_type = 'job_posting'
    and t.reference_id = v_job.id
    and t.transaction_type = 'spend'
    and t.direction = 'debit';

  if v_job.status in ('Published', 'Open') then
    if v_job.mcredit_publication_fee is null then
      return jsonb_build_object('success', false, 'code', 'published_without_a1_evidence');
    end if;

    if v_job.mcredit_publication_fee = 0 then
      if v_job.mcredit_publication_transaction_id is not null then
        return jsonb_build_object('success', false, 'code', 'invalid_zero_fee_publication_evidence');
      end if;
      return jsonb_build_object(
        'success', true,
        'code', 'already_published',
        'job_id', v_job.id,
        'transaction_id', null,
        'fee', 0,
        'status', v_job.status
      );
    end if;

    if v_job.mcredit_publication_transaction_id is null then
      return jsonb_build_object('success', false, 'code', 'published_without_posting_debit');
    end if;

    select * into v_transaction
    from public.mcredit_transactions
    where id = v_job.mcredit_publication_transaction_id;

    if not found
       or v_transaction.reference_type <> 'job_posting'
       or v_transaction.reference_id <> v_job.id
       or v_transaction.transaction_type <> 'spend'
       or v_transaction.direction <> 'debit'
       or v_transaction.amount <> v_job.mcredit_publication_fee
       or not exists (
         select 1
         from public.mcredit_wallets w
         where w.id = v_transaction.wallet_id
           and w.owner_type = v_owner_type
           and w.owner_id = v_owner_id
       ) then
      return jsonb_build_object('success', false, 'code', 'invalid_posting_debit_evidence');
    end if;

    return jsonb_build_object(
      'success', true,
      'code', 'already_published',
      'job_id', v_job.id,
      'transaction_id', v_transaction_id,
      'fee', v_job.mcredit_publication_fee,
      'status', v_job.status
    );
  end if;

  if v_job.status <> 'Draft' then
    return jsonb_build_object('success', false, 'code', 'invalid_job_status', 'status', v_job.status);
  end if;

  if v_transaction_id is not null then
    -- A legitimate debit must never be stranded behind a Draft state.
    perform pg_catalog.set_config('app.atomic_job_publish_id', v_job.id::text, true);
    update public.jobs
    set status = 'Published',
        mcredit_publication_fee = (select amount from public.mcredit_transactions where id = v_transaction_id),
        mcredit_publication_transaction_id = v_transaction_id,
        mcredit_published_at = pg_catalog.now()
    where id = v_job.id;
    perform pg_catalog.set_config('app.atomic_job_publish_id', '', true);
    return jsonb_build_object(
      'success', true,
      'code', 'repaired_published_state',
      'job_id', v_job.id,
      'transaction_id', v_transaction_id,
      'fee', (select amount from public.mcredit_transactions where id = v_transaction_id),
      'status', 'Published'
    );
  end if;

  -- Check if job posting monetization is enabled
  select coalesce(lower(trim(ps.value)), 'true') <> 'false'
  into v_posting_enabled
  from public.platform_settings ps
  where ps.key = 'mcredit_job_posting_enabled';
  v_posting_enabled := coalesce(v_posting_enabled, true);

  if not v_posting_enabled then
    -- Monetization disabled: fee is strictly 0
    v_fee := 0;
    v_fee_percent := 0;

    if p_expected_fee is null or round(p_expected_fee, 2) <> 0 then
      return jsonb_build_object(
        'success', false,
        'code', 'fee_changed',
        'expected_fee', p_expected_fee,
        'authoritative_fee', 0,
        'fee_percent', 0
      );
    end if;
  else
    -- Monetization enabled: compute percentage fee
    select coalesce(nullif(trim(ps.value), '')::numeric, 1)
    into v_fee_percent
    from public.platform_settings ps
    where ps.key = 'company_job_posting_fee_percent';
    v_fee_percent := coalesce(v_fee_percent, 1);
    v_fee := round(coalesce(v_job.salary_numeric, 0) * v_fee_percent / 100, 2);

    if p_expected_fee is null or round(p_expected_fee, 2) <> v_fee then
      return jsonb_build_object(
        'success', false,
        'code', 'fee_changed',
        'expected_fee', p_expected_fee,
        'authoritative_fee', v_fee,
        'fee_percent', v_fee_percent
      );
    end if;
  end if;

  if v_fee > 0 then
    -- Serialize wallet creation and charging across different jobs for the same owner.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner_type || ':' || v_owner_id::text, 0));

    select * into v_wallet
    from public.mcredit_wallets
    where owner_type = v_owner_type and owner_id = v_owner_id
    for update;

    if not found then
      insert into public.mcredit_wallets (owner_type, owner_id, balance, status)
      values (v_owner_type, v_owner_id, 0, 'active')
      returning * into v_wallet;
    end if;

    if v_wallet.status <> 'active' then
      return jsonb_build_object('success', false, 'code', 'wallet_inactive', 'wallet_status', v_wallet.status);
    end if;

    if v_wallet.balance < v_fee then
      return jsonb_build_object(
        'success', false,
        'code', 'insufficient_balance',
        'required', v_fee,
        'available', v_wallet.balance
      );
    end if;

    v_new_balance := v_wallet.balance - v_fee;
    update public.mcredit_wallets
    set balance = v_new_balance, updated_at = pg_catalog.now()
    where id = v_wallet.id;

    insert into public.mcredit_transactions (
      wallet_id, transaction_type, direction, amount, balance_before, balance_after,
      reference_type, reference_id, description, justification_note, created_by
    ) values (
      v_wallet.id, 'spend', 'debit', v_fee, v_wallet.balance, v_new_balance,
      'job_posting', v_job.id,
      'Job posting fee',
      pg_catalog.format('Job posting fee (%s%% of %s) for job %s', v_fee_percent, v_job.salary_numeric, v_job.id),
      v_actor
    ) returning id into v_transaction_id;
  end if;

  perform pg_catalog.set_config('app.atomic_job_publish_id', v_job.id::text, true);
  update public.jobs
  set status = 'Published',
      mcredit_publication_fee = v_fee,
      mcredit_publication_transaction_id = v_transaction_id,
      mcredit_published_at = pg_catalog.now()
  where id = v_job.id;
  perform pg_catalog.set_config('app.atomic_job_publish_id', '', true);

  return jsonb_build_object(
    'success', true,
    'code', 'published',
    'job_id', v_job.id,
    'transaction_id', v_transaction_id,
    'fee', v_fee,
    'new_balance', v_new_balance,
    'wallet_owner_type', v_owner_type,
    'wallet_owner_id', v_owner_id,
    'status', 'Published'
  );
end;
$$;

revoke execute on function public.publish_job_with_mcredit(uuid, numeric) from public, anon;
grant execute on function public.publish_job_with_mcredit(uuid, numeric) to authenticated;
grant execute on function public.publish_job_with_mcredit(uuid, numeric) to service_role;

revoke execute on function public.enforce_atomic_job_publication() from public, anon, authenticated;
