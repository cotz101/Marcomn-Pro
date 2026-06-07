-- SQL Patch: Platform Admin Wallet RLS Owner Access Fix
-- This patch redefines public.is_admin_user(p_user_id) to fix ambiguity and RLS infinite recursion issues.
--
-- Redefining with:
-- 1. Parameter name 'p_user_id' to prevent column reference ambiguity ('pur.user_id = user_id').
-- 2. SECURITY DEFINER and SET search_path = public to avoid RLS recursion and allow secure querying of platforms admin roles.
-- 3. Strict permission checks instead of allowing any active platform admin user.
-- 4. Safe profiles lookup via confirmed 'profiles.id = p_user_id' (which is the user PK linked to auth.users).

-- A. Drop dependent RLS policies so we can drop the old signature of the function
DROP POLICY IF EXISTS "Admin CRUD all wallets" ON mcredit_wallets;
DROP POLICY IF EXISTS "Admin read all transactions" ON mcredit_transactions;

-- B. Drop the old function signature
DROP FUNCTION IF EXISTS public.is_admin_user(uuid);

-- C. Create the redefined function
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
 AS $function$
 BEGIN
   -- 1. Check legacy profiles.global_role fallback
   -- Profiles table uses 'id' (UUID) as the primary key corresponding to auth.users(id).
   IF EXISTS (
     SELECT 1 FROM public.profiles
     WHERE id = p_user_id AND global_role IN ('super_admin', 'admin', 'brand_manager', 'super_user')
   ) THEN
     RETURN TRUE;
   END IF;

   -- 2. Check platform admin user roles with specific wallet/finance permissions
   -- We only treat user as admin if they hold active role with relevant wallet/finance capabilities.
   -- This prevents support_admin or content moderators from gaining full wallet control.
   RETURN EXISTS (
     SELECT 1
     FROM public.platform_admin_user_roles ur
     JOIN public.platform_admin_roles r ON r.id = ur.role_id
     JOIN public.platform_admin_role_permissions rp ON rp.role_id = r.id
     JOIN public.platform_admin_permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = p_user_id
       AND ur.is_active = true
       AND p.permission_key IN (
         'can_view_wallet_control',
         'can_grant_mcredits',
         'can_deduct_mcredits',
         'can_approve_topups',
         'can_reject_topups',
         'can_view_platform_wallet',
         'can_view_finance_reports'
       )
   );
 END;
 $function$;

-- Add comment explaining function and security characteristics
COMMENT ON FUNCTION public.is_admin_user(uuid) IS 'Checks if a user is an admin via legacy global_role or active platform_admin_user_roles with wallet/finance permissions. Runs as SECURITY DEFINER to avoid RLS recursion.';

-- D. Recreate the RLS policies referencing the new function signature
CREATE POLICY "Admin CRUD all wallets" ON mcredit_wallets
    FOR ALL TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admin read all transactions" ON mcredit_transactions
    FOR SELECT TO authenticated USING (is_admin_user(auth.uid()));
