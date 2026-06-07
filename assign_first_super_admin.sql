-- Step 1: Replace the placeholder below with the actual UUID (auth.users.id) of the target user
-- To find target user IDs, you can query:
-- SELECT id, email FROM auth.users;

DO $$
DECLARE
    v_user_id uuid := '00000000-0000-0000-0000-000000000000'; -- <-- REPLACE THIS PLACEHOLDER UUID WITH TARGET USER ID
    v_role_id uuid;
BEGIN
    -- Look up the role ID for super_admin
    SELECT id INTO v_role_id FROM platform_admin_roles WHERE role_key = 'super_admin';

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role super_admin not found. Please ensure platform_admin_roles_migration.sql was run first.';
    END IF;

    -- Ensure we don't try to insert a null user ID if the user forgot to change it
    IF v_user_id = '00000000-0000-0000-0000-000000000000' THEN
        RAISE EXCEPTION 'Please replace the placeholder UUID with a real user ID from auth.users.';
    ELSE
        -- Insert assignment safely
        INSERT INTO platform_admin_user_roles (user_id, role_id, assigned_reason, is_active)
        VALUES (v_user_id, v_role_id, 'Initial platform super admin assignment', true)
        ON CONFLICT (user_id, role_id) 
        DO UPDATE SET is_active = true, updated_at = now();
        
        RAISE NOTICE 'User % successfully assigned to super_admin role.', v_user_id;
    END IF;
END $$;
