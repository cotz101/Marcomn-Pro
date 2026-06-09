-- Stripe Integration Setup Migration
BEGIN;

-- 1. Insert default exchange rate setting in platform_settings if not already present
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES ('mcredits_per_usd', '1.0', now())
ON CONFLICT (key) DO UPDATE
SET updated_at = now()
WHERE platform_settings.key = 'mcredits_per_usd';

-- 2. Redefine get_pending_topup_requests_admin() to isolate Stripe transactions from the manual admin approval queue
CREATE OR REPLACE FUNCTION public.get_pending_topup_requests_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_role text;
  v_has_permission boolean;
BEGIN
  -- Validate caller is admin via legacy role
  SELECT global_role::text INTO v_role
    FROM profiles WHERE id = auth.uid();

  -- Validate caller has permission
  SELECT EXISTS (
    SELECT 1
    FROM platform_admin_user_roles ur
    JOIN platform_admin_roles r ON r.id = ur.role_id
    JOIN platform_admin_role_permissions rp ON rp.role_id = r.id
    JOIN platform_admin_permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND ur.is_active = true
      AND p.permission_key = 'can_view_wallet_control'
  ) INTO v_has_permission;

  IF (v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'brand_manager')) AND NOT v_has_permission THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        req.id,
        req.owner_type,
        req.owner_id,
        req.requester_id,
        req.amount,
        req.status,
        req.remarks,
        req.created_at,
        -- Requester (personal)
        p.name         AS requester_name,
        p.avatar_url   AS requester_avatar_url,
        -- Company identity (only when owner_type = 'company')
        c.name         AS company_name,
        c.logo_url     AS company_logo_url
      FROM mcredit_topup_requests req
      LEFT JOIN profiles  p ON p.id  = req.requester_id
      LEFT JOIN companies c ON c.id  = req.owner_id AND req.owner_type = 'company'
      WHERE req.status = 'Pending' AND req.payment_method = 'dummy_manual'
      ORDER BY req.created_at ASC
    ) r
  );
END;
$function$;

COMMIT;
