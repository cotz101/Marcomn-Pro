-- Platform Admin Role & Access Control - testing SQL snippets

-- Replace 'USER_UUID_HERE' with the target user's UUID (from auth.users.id)
-- Replace 'ROLE_KEY_HERE' with one of the seeded system roles:
-- 'super_admin', 'finance_admin', 'wallet_admin', 'support_admin', 'moderator'

-- ==========================================
-- 1. ASSIGN A ROLE TO A USER (IDEMPOTENT)
-- ==========================================
DO $$
DECLARE
    v_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- <-- REPLACE THIS WITH REAL USER UUID
    v_role_key text := 'ROLE_KEY_HERE';                     -- <-- REPLACE THIS WITH ROLE KEY ('support_admin', 'wallet_admin', 'finance_admin')
    v_role_id uuid;
BEGIN
    SELECT id INTO v_role_id FROM platform_admin_roles WHERE role_key = v_role_key;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role % not found.', v_role_key;
    END IF;

    IF v_user_id = '00000000-0000-0000-0000-000000000000' OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'Please provide a valid user UUID.';
    END IF;

    INSERT INTO platform_admin_user_roles (user_id, role_id, assigned_reason, is_active)
    VALUES (v_user_id, v_role_id, 'Manual testing assignment: ' || v_role_key, true)
    ON CONFLICT (user_id, role_id)
    DO UPDATE SET is_active = true, updated_at = now();

    RAISE NOTICE 'Role % successfully assigned to user %.', v_role_key, v_user_id;
END $$;


-- ==========================================
-- 2. DEACTIVATE AN ADMIN ROLE ASSIGNMENT
-- ==========================================
UPDATE platform_admin_user_roles
SET is_active = false, updated_at = now()
WHERE user_id = '00000000-0000-0000-0000-000000000000' -- <-- REPLACE WITH REAL USER UUID
  AND role_id = (SELECT id FROM platform_admin_roles WHERE role_key = 'ROLE_KEY_HERE'); -- <-- REPLACE WITH ROLE KEY


-- ==========================================
-- 3. LIST CURRENT ADMIN USER-ROLE ASSIGNMENTS
-- ==========================================
SELECT 
    ur.id as assignment_id,
    u.email,
    r.role_key,
    r.role_name,
    ur.is_active,
    ur.assigned_reason,
    ur.created_at
FROM platform_admin_user_roles ur
JOIN platform_admin_roles r ON ur.role_id = r.id
JOIN auth.users u ON ur.user_id = u.id
ORDER BY ur.created_at DESC;


-- ==========================================
-- 4. CHECK USER PERMISSIONS BY USER ID
-- ==========================================
-- Run this to verify all permissions resolved for a specific user ID
SELECT DISTINCT
    p.permission_key,
    p.permission_name,
    p.category
FROM platform_admin_user_roles ur
JOIN platform_admin_roles r ON ur.role_id = r.id
JOIN platform_admin_role_permissions rp ON rp.role_id = r.id
JOIN platform_admin_permissions p ON rp.permission_id = p.id
WHERE ur.user_id = '00000000-0000-0000-0000-000000000000' -- <-- REPLACE WITH REAL USER UUID
  AND ur.is_active = true;
