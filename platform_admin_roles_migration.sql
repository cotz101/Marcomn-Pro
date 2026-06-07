-- Stage Admin-1: Platform Admin Role & Access Control database foundation

-- A. platform_admin_roles
CREATE TABLE IF NOT EXISTS platform_admin_roles (
    id uuid primary key default gen_random_uuid(),
    role_key text unique not null,
    role_name text not null,
    description text,
    is_system_role boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Seed system roles
INSERT INTO platform_admin_roles (role_key, role_name, description) VALUES
    ('super_admin', 'Super Admin', 'Full platform control'),
    ('finance_admin', 'Finance Admin', 'Finance dashboard, reports, receipts, top-up reports'),
    ('wallet_admin', 'Wallet Admin', 'Manage MCredits wallet control, grant/deduct credits, top-up approvals'),
    ('support_admin', 'Support Admin', 'View basic user/wallet status for support'),
    ('moderator', 'Moderator', 'Manage community/content reports')
ON CONFLICT (role_key) DO NOTHING;

-- B. platform_admin_permissions
CREATE TABLE IF NOT EXISTS platform_admin_permissions (
    id uuid primary key default gen_random_uuid(),
    permission_key text unique not null,
    permission_name text not null,
    description text,
    category text,
    created_at timestamptz default now()
);

-- Seed permissions
INSERT INTO platform_admin_permissions (permission_key, permission_name, category) VALUES
    ('can_access_platform_admin', 'Access Platform Admin', 'Dashboard'),
    ('can_view_wallet_summary', 'View Wallet Summary', 'Wallet'),
    ('can_view_wallet_control', 'View Wallet Control', 'Wallet'),
    ('can_grant_mcredits', 'Grant MCredits', 'Wallet'),
    ('can_deduct_mcredits', 'Deduct MCredits', 'Wallet'),
    ('can_approve_topups', 'Approve Top-ups', 'Top-ups'),
    ('can_reject_topups', 'Reject Top-ups', 'Top-ups'),
    ('can_view_platform_wallet', 'View Platform Wallet', 'Wallet'),
    ('can_view_finance_reports', 'View Finance Reports', 'Finance'),
    ('can_manage_global_settings', 'Manage Global Settings', 'Settings'),
    ('can_manage_admin_roles', 'Manage Admin Roles', 'Roles'),
    ('can_view_admin_audit_logs', 'View Admin Audit Logs', 'Audit'),
    ('can_moderate_content', 'Moderate Content', 'Moderation'),
    ('can_manage_refund_reviews', 'Manage Refund Reviews', 'Disputes')
ON CONFLICT (permission_key) DO NOTHING;

-- C. platform_admin_role_permissions
CREATE TABLE IF NOT EXISTS platform_admin_role_permissions (
    id uuid primary key default gen_random_uuid(),
    role_id uuid references platform_admin_roles(id) on delete cascade,
    permission_id uuid references platform_admin_permissions(id) on delete cascade,
    created_at timestamptz default now(),
    unique(role_id, permission_id)
);

-- Seed role permissions

-- Helper to insert mapping securely
DO $$
DECLARE
    v_super_admin uuid;
    v_finance_admin uuid;
    v_wallet_admin uuid;
    v_support_admin uuid;
    v_moderator uuid;
BEGIN
    SELECT id INTO v_super_admin FROM platform_admin_roles WHERE role_key = 'super_admin';
    SELECT id INTO v_finance_admin FROM platform_admin_roles WHERE role_key = 'finance_admin';
    SELECT id INTO v_wallet_admin FROM platform_admin_roles WHERE role_key = 'wallet_admin';
    SELECT id INTO v_support_admin FROM platform_admin_roles WHERE role_key = 'support_admin';
    SELECT id INTO v_moderator FROM platform_admin_roles WHERE role_key = 'moderator';

    -- super_admin: all permissions
    INSERT INTO platform_admin_role_permissions (role_id, permission_id)
    SELECT v_super_admin, id FROM platform_admin_permissions
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- finance_admin
    INSERT INTO platform_admin_role_permissions (role_id, permission_id)
    SELECT v_finance_admin, id FROM platform_admin_permissions
    WHERE permission_key IN (
        'can_access_platform_admin', 'can_view_wallet_summary', 'can_view_platform_wallet',
        'can_view_finance_reports', 'can_view_admin_audit_logs'
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- wallet_admin
    INSERT INTO platform_admin_role_permissions (role_id, permission_id)
    SELECT v_wallet_admin, id FROM platform_admin_permissions
    WHERE permission_key IN (
        'can_access_platform_admin', 'can_view_wallet_summary', 'can_view_wallet_control',
        'can_grant_mcredits', 'can_deduct_mcredits', 'can_approve_topups', 'can_reject_topups', 'can_view_admin_audit_logs'
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- support_admin
    INSERT INTO platform_admin_role_permissions (role_id, permission_id)
    SELECT v_support_admin, id FROM platform_admin_permissions
    WHERE permission_key IN (
        'can_access_platform_admin', 'can_view_wallet_summary'
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- moderator
    INSERT INTO platform_admin_role_permissions (role_id, permission_id)
    SELECT v_moderator, id FROM platform_admin_permissions
    WHERE permission_key IN (
        'can_access_platform_admin', 'can_moderate_content', 'can_view_admin_audit_logs'
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;

-- D. platform_admin_user_roles
CREATE TABLE IF NOT EXISTS platform_admin_user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    role_id uuid not null references platform_admin_roles(id) on delete cascade,
    assigned_by uuid references auth.users(id),
    assigned_reason text,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(user_id, role_id)
);

-- E. platform_admin_audit_logs
CREATE TABLE IF NOT EXISTS platform_admin_audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid references auth.users(id),
    action_key text not null,
    target_type text,
    target_id text,
    details jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

-- 3. RLS policies

ALTER TABLE platform_admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to allow safe re-running of this script
DROP POLICY IF EXISTS "Admin roles are viewable by platform admins only" ON platform_admin_roles;
CREATE POLICY "Admin roles are viewable by platform admins only" ON platform_admin_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_admin_user_roles pur
            WHERE pur.user_id = auth.uid() AND pur.is_active = true
        )
    );

DROP POLICY IF EXISTS "Admin permissions are viewable by platform admins only" ON platform_admin_permissions;
CREATE POLICY "Admin permissions are viewable by platform admins only" ON platform_admin_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_admin_user_roles pur
            WHERE pur.user_id = auth.uid() AND pur.is_active = true
        )
    );

DROP POLICY IF EXISTS "Admin role permissions are viewable by platform admins only" ON platform_admin_role_permissions;
CREATE POLICY "Admin role permissions are viewable by platform admins only" ON platform_admin_role_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_admin_user_roles pur
            WHERE pur.user_id = auth.uid() AND pur.is_active = true
        )
    );

DROP POLICY IF EXISTS "Users can see their own admin roles" ON platform_admin_user_roles;
CREATE POLICY "Users can see their own admin roles" ON platform_admin_user_roles
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can see all user roles" ON platform_admin_user_roles;
CREATE POLICY "Platform admins can see all user roles" ON platform_admin_user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_admin_user_roles pur
            WHERE pur.user_id = auth.uid() AND pur.is_active = true
        )
    );

