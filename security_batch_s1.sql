-- Security Batch S1
-- Database Hardening for Wallets, Transactions, and Admin Role Management

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Secure adjust_wallet_balance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(
    p_wallet_id uuid,
    p_amount numeric,
    p_direction text,
    p_transaction_type text,
    p_justification_note text,
    p_created_by uuid,
    p_reference_type text DEFAULT NULL::text,
    p_reference_id uuid DEFAULT NULL::uuid,
    p_override_insufficient boolean DEFAULT false
)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_current_balance NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_status TEXT;
BEGIN
    -- Security check: allow service_role bypass or require admin status/permissions
    IF auth.role() <> 'service_role' AND NOT (
        public.is_admin_user(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND global_role IN ('super_admin', 'admin')
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators or server services can adjust wallet balance.';
    END IF;

    -- Validate inputs
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transaction amount must be positive. Provided: %', p_amount;
    END IF;

    IF p_direction NOT IN ('credit', 'debit') THEN
        RAISE EXCEPTION 'Direction must be credit or debit. Provided: %', p_direction;
    END IF;

    IF p_transaction_type NOT IN ('admin_grant', 'admin_deduct', 'purchase_pending', 'purchase_completed', 'spend', 'refund', 'adjustment', 'penalty', 'platform_revenue') THEN
        RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
    END IF;

    IF p_transaction_type IN ('admin_grant', 'admin_deduct') AND (p_justification_note IS NULL OR trim(p_justification_note) = '') THEN
        RAISE EXCEPTION 'Justification note is required for admin adjustments.';
    END IF;

    -- Lock wallet row
    SELECT balance, status INTO v_current_balance, v_status
    FROM public.mcredit_wallets
    WHERE id = p_wallet_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet with ID % not found.', p_wallet_id;
    END IF;

    IF v_status != 'active' THEN
        RAISE EXCEPTION 'Wallet is not active. Status: %', v_status;
    END IF;

    -- Calculate new balance
    IF p_direction = 'credit' THEN
        v_new_balance := v_current_balance + p_amount;
    ELSE
        v_new_balance := v_current_balance - p_amount;
        IF v_new_balance < 0 AND NOT p_override_insufficient THEN
            RAISE EXCEPTION 'Insufficient wallet balance. Current: %, Deduct: %', v_current_balance, p_amount;
        END IF;
    END IF;

    -- Update wallet balance
    UPDATE public.mcredit_wallets
    SET balance = v_new_balance,
        updated_at = now()
    WHERE id = p_wallet_id;

    -- Log transaction
    INSERT INTO public.mcredit_transactions (
        wallet_id,
        transaction_type,
        direction,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        description,
        justification_note,
        created_by,
        created_at
    )
    VALUES (
        p_wallet_id,
        p_transaction_type,
        p_direction,
        p_amount,
        v_current_balance,
        v_new_balance,
        p_reference_type,
        p_reference_id,
        COALESCE(p_justification_note, 'Wallet transaction ' || p_transaction_type),
        p_justification_note,
        p_created_by,
        now()
    );

    RETURN v_new_balance;
END;
$function$;

-- Revoke public execution privileges (defense-in-depth)
REVOKE EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric, text, text, text, uuid, text, uuid, boolean) FROM public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop instant_personal_topup
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.instant_personal_topup(uuid, numeric, text);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Secure sync_role_permissions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_role_permissions(
  p_role_id uuid,
  p_permission_keys text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_key text;
  v_permission_ids uuid[];
BEGIN
  -- Security check: allow service_role bypass or require can_manage_admin_roles / admin status
  IF auth.role() <> 'service_role' AND NOT (
    public.current_user_has_platform_admin_permission('can_manage_admin_roles')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND global_role IN ('super_admin', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Missing permission can_manage_admin_roles';
  END IF;

  -- 1. Check if the role exists and get its key
  SELECT role_key INTO v_role_key
  FROM public.platform_admin_roles
  WHERE id = p_role_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  -- 2. Reject editing super_admin
  IF v_role_key = 'super_admin' THEN
    RAISE EXCEPTION 'System protected role: super_admin permissions cannot be modified.';
  END IF;

  -- 3. Resolve permission keys to IDs
  -- Ensure that if an empty array is passed, it clears the role correctly.
  IF array_length(p_permission_keys, 1) > 0 THEN
    SELECT array_agg(id) INTO v_permission_ids
    FROM public.platform_admin_permissions
    WHERE permission_key = ANY(p_permission_keys);

    -- Ensure we don't proceed with null if keys were provided but none matched.
    IF v_permission_ids IS NULL THEN
      RAISE EXCEPTION 'None of the provided permission keys were found in the database.';
    END IF;
  ELSE
    v_permission_ids := ARRAY[]::uuid[];
  END IF;

  -- 4. Sync: Delete existing permissions for this role
  DELETE FROM public.platform_admin_role_permissions
  WHERE role_id = p_role_id;

  -- 5. Sync: Insert new permissions
  IF array_length(v_permission_ids, 1) > 0 THEN
    INSERT INTO public.platform_admin_role_permissions (role_id, permission_id)
    SELECT p_role_id, unnest(v_permission_ids);
  END IF;

END;
$$;

-- Revoke public execution privileges (defense-in-depth)
REVOKE EXECUTE ON FUNCTION public.sync_role_permissions(uuid, text[]) FROM public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Add Idempotency Unique Index on mcredit_transactions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mcredit_transaction_ref 
ON public.mcredit_transactions(reference_type, reference_id) 
WHERE reference_id IS NOT NULL;

COMMIT;
