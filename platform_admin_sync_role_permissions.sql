BEGIN;

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

COMMIT;
