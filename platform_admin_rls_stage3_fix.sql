-- SQL Patch: Platform Admin RLS and Helper Function Fixes (Stage Admin-3 Testing)
-- This file captures the exact database updates applied to support granular platform admin roles.

-- 1. Redefine is_admin_user(user_id) to support both legacy global_roles and platform_admin_user_roles
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 AS $function$
 BEGIN
   RETURN EXISTS (
     SELECT 1 FROM public.profiles
     WHERE id = user_id AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
   ) OR EXISTS (
     SELECT 1 FROM platform_admin_user_roles pur
     WHERE pur.user_id = user_id AND pur.is_active = true
   );
 END;
 $function$;

-- 2. Redefine get_pending_topup_requests_admin() RPC to support active platform admins with wallet control
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
       WHERE req.status = 'Pending'
       ORDER BY req.created_at ASC
     ) r
   );
 END;
 $function$;

-- 3. Update mcredit_topup_requests RLS Policies
DROP POLICY IF EXISTS "Admins can select all requests" ON mcredit_topup_requests;
CREATE POLICY "Admins can select all requests" ON mcredit_topup_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.global_role = ANY (ARRAY['super_admin'::platform_global_role, 'admin'::platform_global_role, 'brand_manager'::platform_global_role])
        ) OR EXISTS (
            SELECT 1 FROM platform_admin_user_roles pur
            WHERE pur.user_id = auth.uid()
              AND pur.is_active = true
        )
    );

DROP POLICY IF EXISTS "Admins can update all requests" ON mcredit_topup_requests;
CREATE POLICY "Admins can update all requests" ON mcredit_topup_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.global_role = ANY (ARRAY['super_admin'::platform_global_role, 'admin'::platform_global_role, 'brand_manager'::platform_global_role])
        ) OR EXISTS (
            SELECT 1 FROM platform_admin_user_roles ur
            JOIN platform_admin_roles r ON r.id = ur.role_id
            JOIN platform_admin_role_permissions rp ON rp.role_id = r.id
            JOIN platform_admin_permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
              AND ur.is_active = true
              AND p.permission_key IN ('can_approve_topups', 'can_reject_topups')
        )
    );

-- 4. Update mcredit_receipts RLS Policies
DROP POLICY IF EXISTS "Admins can select all receipts" ON mcredit_receipts;
CREATE POLICY "Admins can select all receipts" ON mcredit_receipts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.global_role = ANY (ARRAY['super_admin'::platform_global_role, 'admin'::platform_global_role, 'brand_manager'::platform_global_role])
        ) OR EXISTS (
            SELECT 1 FROM platform_admin_user_roles pur
            WHERE pur.user_id = auth.uid()
              AND pur.is_active = true
        )
    );

DROP POLICY IF EXISTS "Admins can insert all receipts" ON mcredit_receipts;
CREATE POLICY "Admins can insert all receipts" ON mcredit_receipts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.global_role = ANY (ARRAY['super_admin'::platform_global_role, 'admin'::platform_global_role, 'brand_manager'::platform_global_role])
        ) OR EXISTS (
            SELECT 1 FROM platform_admin_user_roles ur
            JOIN platform_admin_roles r ON r.id = ur.role_id
            JOIN platform_admin_role_permissions rp ON rp.role_id = r.id
            JOIN platform_admin_permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
              AND ur.is_active = true
              AND p.permission_key IN ('can_approve_topups', 'can_reject_topups', 'can_view_wallet_control')
        )
    );

DROP POLICY IF EXISTS "Admins can update all receipts" ON mcredit_receipts;
CREATE POLICY "Admins can update all receipts" ON mcredit_receipts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.global_role = ANY (ARRAY['super_admin'::platform_global_role, 'admin'::platform_global_role, 'brand_manager'::platform_global_role])
        ) OR EXISTS (
            SELECT 1 FROM platform_admin_user_roles pur
            WHERE pur.user_id = auth.uid()
              AND pur.is_active = true
        )
    );

-- 5. Update platform_settings RLS Policies
DROP POLICY IF EXISTS "Admin Update platform_settings" ON platform_settings;
CREATE POLICY "Admin Update platform_settings" ON platform_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND ((profiles.global_role)::text = ANY (ARRAY['super_admin'::text, 'admin'::text, 'brand_manager'::text, 'super_user'::text]))
        ) OR EXISTS (
            SELECT 1 FROM platform_admin_user_roles ur
            JOIN platform_admin_roles r ON r.id = ur.role_id
            JOIN platform_admin_role_permissions rp ON rp.role_id = r.id
            JOIN platform_admin_permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
              AND ur.is_active = true
              AND p.permission_key = 'can_manage_global_settings'
        )
    );
