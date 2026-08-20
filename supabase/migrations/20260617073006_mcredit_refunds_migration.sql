-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: DATABASE FOUNDATION
-- Migration script to create public.mcredit_refund_requests table and permissions
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.mcredit_refund_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    company_id uuid references public.companies(id) on delete set null,
    wallet_id uuid not null references public.mcredit_wallets(id) on delete cascade,
    topup_request_id uuid references public.mcredit_topup_requests(id) on delete set null,
    original_transaction_id uuid references public.mcredit_transactions(id) on delete set null,
    stripe_payment_intent_id text,
    stripe_charge_id text,
    requested_mcredits numeric not null,
    max_refundable_mcredits_snapshot numeric not null,
    approved_mcredits numeric,
    gross_refund_amount numeric,
    fee_deduction_amount numeric default 0,
    net_refund_amount numeric,
    currency text default 'USD',
    reason text not null,
    user_note text,
    admin_note text,
    status text not null default 'pending_review',
    approved_by uuid references auth.users(id) on delete set null,
    approved_at timestamptz,
    rejected_by uuid references auth.users(id) on delete set null,
    rejected_at timestamptz,
    stripe_refund_id text,
    stripe_refund_status text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    CONSTRAINT chk_status CHECK (status IN ('pending_review', 'approved', 'rejected', 'processing', 'refunded', 'failed', 'cancelled')),
    CONSTRAINT chk_requested_mcredits CHECK (requested_mcredits > 0),
    CONSTRAINT chk_approved_mcredits CHECK (approved_mcredits IS NULL OR approved_mcredits >= 0),
    CONSTRAINT chk_gross_refund_amount CHECK (gross_refund_amount IS NULL OR gross_refund_amount >= 0),
    CONSTRAINT chk_fee_deduction_amount CHECK (fee_deduction_amount >= 0),
    CONSTRAINT chk_net_refund_amount CHECK (net_refund_amount IS NULL OR net_refund_amount >= 0),
    CONSTRAINT chk_max_refundable_mcredits_snapshot CHECK (max_refundable_mcredits_snapshot >= 0),
    CONSTRAINT chk_reason CHECK (reason IN ('unused_credits', 'duplicate_payment', 'technical_payment_issue', 'incorrect_crediting', 'unauthorized_charge_concern', 'other'))
);

-- 2. Indexes for search and join performance
CREATE INDEX IF NOT EXISTS idx_mcredit_refunds_user_id ON public.mcredit_refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_mcredit_refunds_wallet_id ON public.mcredit_refund_requests(wallet_id);
CREATE INDEX IF NOT EXISTS idx_mcredit_refunds_company_id ON public.mcredit_refund_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_mcredit_refunds_topup_request_id ON public.mcredit_refund_requests(topup_request_id);
CREATE INDEX IF NOT EXISTS idx_mcredit_refunds_status ON public.mcredit_refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_mcredit_refunds_created_at ON public.mcredit_refund_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_mcredit_refunds_stripe_pi_id ON public.mcredit_refund_requests(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_mcredit_refunds_stripe_refund_id ON public.mcredit_refund_requests(stripe_refund_id);

-- Partial unique index to prevent duplicate active refund requests for the same top-up
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_mcredit_refund_per_topup
ON public.mcredit_refund_requests(topup_request_id)
WHERE topup_request_id IS NOT NULL
AND status IN ('pending_review', 'processing');

-- 3. Trigger for updated_at column
DROP TRIGGER IF EXISTS update_mcredit_refund_requests_updated_at ON public.mcredit_refund_requests;
CREATE TRIGGER update_mcredit_refund_requests_updated_at
BEFORE UPDATE ON public.mcredit_refund_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.mcredit_refund_requests ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies

-- SELECT: users can view their own, or admin roles can view (super_admin and admin only for legacy roles)
DROP POLICY IF EXISTS "Users can select own refund requests" ON public.mcredit_refund_requests;
CREATE POLICY "Users can select own refund requests" ON public.mcredit_refund_requests
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.global_role = ANY (ARRAY['super_admin'::platform_global_role, 'admin'::platform_global_role])
        ) OR EXISTS (
            SELECT 1 FROM public.platform_admin_user_roles ur
            JOIN public.platform_admin_roles r ON r.id = ur.role_id
            JOIN public.platform_admin_role_permissions rp ON rp.role_id = r.id
            JOIN public.platform_admin_permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
              AND ur.is_active = true
              AND p.permission_key IN ('can_manage_refund_reviews', 'can_view_wallet_summary')
        )
    );

-- INSERT: users can insert for their own wallets and status must be 'pending_review'
DROP POLICY IF EXISTS "Users can insert own refund requests" ON public.mcredit_refund_requests;
CREATE POLICY "Users can insert own refund requests" ON public.mcredit_refund_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND status = 'pending_review'
        AND EXISTS (
            SELECT 1 FROM public.mcredit_wallets w
            WHERE w.id = wallet_id
              AND (
                  (w.owner_type = 'user' AND w.owner_id = auth.uid())
                  OR
                  (w.owner_type = 'company' AND EXISTS (
                      SELECT 1 FROM public.company_members cm
                      WHERE cm.company_id = w.owner_id AND cm.profile_id = auth.uid()
                  ))
              )
        )
    );

-- UPDATE: only admins with manage_refund_reviews permission or legacy super_admin/admin roles can update status/fields
DROP POLICY IF EXISTS "Admins can update refund requests" ON public.mcredit_refund_requests;
CREATE POLICY "Admins can update refund requests" ON public.mcredit_refund_requests
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.global_role = ANY (ARRAY['super_admin'::platform_global_role, 'admin'::platform_global_role])
        ) OR EXISTS (
            SELECT 1 FROM public.platform_admin_user_roles ur
            JOIN public.platform_admin_roles r ON r.id = ur.role_id
            JOIN public.platform_admin_role_permissions rp ON rp.role_id = r.id
            JOIN public.platform_admin_permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
              AND ur.is_active = true
              AND p.permission_key = 'can_manage_refund_reviews'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.global_role = ANY (ARRAY['super_admin'::platform_global_role, 'admin'::platform_global_role])
        ) OR EXISTS (
            SELECT 1 FROM public.platform_admin_user_roles ur
            JOIN public.platform_admin_roles r ON r.id = ur.role_id
            JOIN public.platform_admin_role_permissions rp ON rp.role_id = r.id
            JOIN public.platform_admin_permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
              AND ur.is_active = true
              AND p.permission_key = 'can_manage_refund_reviews'
        )
    );

-- 6. Seed/Register 'can_manage_refund_reviews' permission and role bindings
INSERT INTO public.platform_admin_permissions (permission_key, permission_name, category)
VALUES ('can_manage_refund_reviews', 'Manage Refund Reviews', 'Disputes')
ON CONFLICT (permission_key) DO NOTHING;

-- Bind the permission to super_admin and finance_admin roles
DO $$
DECLARE
    v_perm_id uuid;
    v_role_super uuid;
    v_role_finance uuid;
    v_role_admin uuid;
BEGIN
    SELECT id INTO v_perm_id FROM public.platform_admin_permissions WHERE permission_key = 'can_manage_refund_reviews';
    SELECT id INTO v_role_super FROM public.platform_admin_roles WHERE role_key = 'super_admin';
    SELECT id INTO v_role_finance FROM public.platform_admin_roles WHERE role_key = 'finance_admin';
    SELECT id INTO v_role_admin FROM public.platform_admin_roles WHERE role_key = 'admin';

    IF v_perm_id IS NOT NULL THEN
        IF v_role_super IS NOT NULL THEN
            INSERT INTO public.platform_admin_role_permissions (role_id, permission_id)
            VALUES (v_role_super, v_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        IF v_role_finance IS NOT NULL THEN
            INSERT INTO public.platform_admin_role_permissions (role_id, permission_id)
            VALUES (v_role_finance, v_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
        IF v_role_admin IS NOT NULL THEN
            INSERT INTO public.platform_admin_role_permissions (role_id, permission_id)
            VALUES (v_role_admin, v_perm_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;
;
