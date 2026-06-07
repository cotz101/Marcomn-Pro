'use server';

import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isPlatformAdmin, userHasAdminPermission, getCurrentUserAdminRoles } from '@/lib/adminPermissions';
import { logPlatformAdminAction } from '@/lib/adminAuditLogger';

/**
 * Creates a server-side Supabase client using the Service Role Key.
 * This client bypasses RLS for mutations (insert/update) on the platform_admin tables.
 */
function createServiceSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase Service Role Key or URL is missing.');
  }

  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

/**
 * Check if the caller is a super_admin (or legacy super user)
 */
async function checkIsSuperAdmin(userId) {
  const roles = await getCurrentUserAdminRoles(userId);
  return roles.includes('super_admin');
}

/**
 * Fetch all available platform roles and current active admin user assignments.
 */
export async function getAdminRolesAndUsers() {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(user.id, 'can_manage_admin_roles');
    if (!hasPermission) throw new Error('Permission denied');

    // 1. Fetch all platform roles
    const { data: roles, error: rolesError } = await supabase
      .from('platform_admin_roles')
      .select('*')
      .order('role_name');
    if (rolesError) throw rolesError;

    // 2. Fetch all active role assignments
    const { data: userRolesRaw, error: userRolesError } = await supabase
      .from('platform_admin_user_roles')
      .select(`
        id,
        user_id,
        role_id,
        assigned_by,
        assigned_reason,
        is_active,
        created_at,
        platform_admin_roles ( role_key, role_name )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (userRolesError) throw userRolesError;

    // Collect all user IDs involved (assignees and assignors) to fetch profiles
    const userIds = new Set();
    userRolesRaw?.forEach(ur => {
      if (ur.user_id) userIds.add(ur.user_id);
      if (ur.assigned_by) userIds.add(ur.assigned_by);
    });

    const profilesMap = {};
    if (userIds.size > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', Array.from(userIds));
      if (profilesError) throw profilesError;

      const serviceSupabase = createServiceSupabaseClient();
      const emailMap = {};
      
      await Promise.all(Array.from(userIds).map(async (id) => {
        try {
          const { data } = await serviceSupabase.auth.admin.getUserById(id);
          if (data?.user?.email) {
            emailMap[id] = data.user.email;
          }
        } catch (e) {
          console.error(`Failed to fetch email for user ${id}`, e);
        }
      }));

      profiles?.forEach(p => {
        profilesMap[p.id] = { ...p, email: emailMap[p.id] || 'No email available' };
      });
    }

    // Attach profile information
    const userRoles = userRolesRaw.map(ur => ({
      ...ur,
      profile: profilesMap[ur.user_id] || { name: 'Unknown', email: 'No email available' },
      assignor: ur.assigned_by ? (profilesMap[ur.assigned_by] || { name: 'System', email: 'No email available' }) : null
    }));

    return { success: true, roles, userRoles };
  } catch (error) {
    console.error('Error in getAdminRolesAndUsers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search platform users by name or email (to promote to admin roles).
 */
export async function searchSystemUsers(query) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(user.id, 'can_manage_admin_roles');
    if (!hasPermission) throw new Error('Permission denied');

    if (!query || query.trim().length < 2) {
      return { success: true, users: [] };
    }

    const { data: usersByName, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, global_role')
      .ilike('name', `%${query}%`)
      .limit(15);

    if (error) throw error;

    let matchedUsers = usersByName || [];
    const serviceSupabase = createServiceSupabaseClient();

    try {
      // Fetch users from auth.users to match email (limited safe search via service role)
      const { data: authData } = await serviceSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      if (authData?.users) {
        const emailMatches = authData.users.filter(u => 
          u.email && u.email.toLowerCase().includes(query.toLowerCase())
        );
        
        for (const authUser of emailMatches) {
          if (!matchedUsers.find(u => u.id === authUser.id)) {
            const { data: pData } = await supabase.from('profiles')
              .select('id, name, avatar_url, global_role')
              .eq('id', authUser.id)
              .maybeSingle();
            if (pData) {
              matchedUsers.push({ ...pData, email: authUser.email });
            } else {
              matchedUsers.push({ id: authUser.id, name: 'Unknown', email: authUser.email });
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to search auth users by email', err);
    }

    // Ensure all matches have an email attached
    await Promise.all(matchedUsers.map(async (u) => {
      if (!u.email) {
        try {
          const { data } = await serviceSupabase.auth.admin.getUserById(u.id);
          u.email = data?.user?.email || 'No email available';
        } catch (e) {
          u.email = 'No email available';
        }
      }
    }));

    // Return unique results
    const uniqueUsers = Array.from(new Map(matchedUsers.map(u => [u.id, u])).values()).slice(0, 15);

    return { success: true, users: uniqueUsers };
  } catch (error) {
    console.error('Error in searchSystemUsers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Assign a platform admin role to a user.
 */
export async function assignPlatformRole(targetUserId, roleId, reason) {
  const supabase = await createClient();
  const serviceSupabase = createServiceSupabaseClient();

  try {
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(caller.id, 'can_manage_admin_roles');
    if (!hasPermission) throw new Error('Permission denied');

    // 1. Fetch the target role details
    const { data: role, error: roleError } = await supabase
      .from('platform_admin_roles')
      .select('role_key, role_name')
      .eq('id', roleId)
      .single();
    if (roleError || !role) throw new Error('Target role not found');

    // 2. Safeguard: Non-super admins cannot grant the super_admin role
    if (role.role_key === 'super_admin') {
      const callerIsSuper = await checkIsSuperAdmin(caller.id);
      if (!callerIsSuper) {
        throw new Error('Only a Super Admin can assign the Super Admin role');
      }
    }

    // 3. Check if assignment already exists
    const { data: existing, error: existingError } = await serviceSupabase
      .from('platform_admin_user_roles')
      .select('id, is_active')
      .eq('user_id', targetUserId)
      .eq('role_id', roleId)
      .maybeSingle();

    if (existing) {
      if (existing.is_active) {
        throw new Error('User already has this role actively assigned');
      }
      // Re-activate existing assignment
      const { error: updateError } = await serviceSupabase
        .from('platform_admin_user_roles')
        .update({
          is_active: true,
          assigned_by: caller.id,
          assigned_reason: reason || 'Re-assigned via admin UI',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      if (updateError) throw updateError;
    } else {
      // Create new assignment
      const { error: insertError } = await serviceSupabase
        .from('platform_admin_user_roles')
        .insert({
          user_id: targetUserId,
          role_id: roleId,
          assigned_by: caller.id,
          assigned_reason: reason || 'Assigned via admin UI',
          is_active: true
        });
      if (insertError) throw insertError;
    }

    // 4. Log the admin action to platform_admin_audit_logs
    await logPlatformAdminAction({
      actorUserId: caller.id,
      actionKey: 'role.assigned',
      targetType: 'user',
      targetId: targetUserId,
      details: {
        role_key: role.role_key,
        role_name: role.role_name,
        role_id: roleId,
        reason: reason || ''
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error in assignPlatformRole:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Revoke/deactivate a user role assignment.
 */
export async function revokePlatformRole(userRoleId) {
  const supabase = await createClient();
  const serviceSupabase = createServiceSupabaseClient();

  try {
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(caller.id, 'can_manage_admin_roles');
    if (!hasPermission) throw new Error('Permission denied');

    // 1. Fetch existing user role assignment details
    const { data: userRole, error: userRoleError } = await serviceSupabase
      .from('platform_admin_user_roles')
      .select(`
        id,
        user_id,
        role_id,
        is_active,
        platform_admin_roles ( role_key, role_name )
      `)
      .eq('id', userRoleId)
      .single();
    if (userRoleError || !userRole) throw new Error('Assignment not found');

    if (!userRole.is_active) {
      throw new Error('Role assignment is already inactive');
    }

    const targetRoleKey = userRole.platform_admin_roles?.role_key;
    const targetUserId = userRole.user_id;

    // 2. Safeguard: Users cannot revoke their own roles
    if (targetUserId === caller.id) {
      throw new Error('Self-lockout protection: You cannot revoke your own active platform roles.');
    }

    // 3. Safeguard: Non-super admins cannot revoke super_admin role
    if (targetRoleKey === 'super_admin') {
      const callerIsSuper = await checkIsSuperAdmin(caller.id);
      if (!callerIsSuper) {
        throw new Error('Only a Super Admin can revoke a Super Admin role');
      }
    }

    // 4. Perform deactivation
    const { error: updateError } = await serviceSupabase
      .from('platform_admin_user_roles')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userRoleId);
    if (updateError) throw updateError;

    // 5. Log the admin action to platform_admin_audit_logs
    await logPlatformAdminAction({
      actorUserId: caller.id,
      actionKey: 'role.revoked',
      targetType: 'user',
      targetId: targetUserId,
      details: {
        role_key: targetRoleKey,
        role_name: userRole.platform_admin_roles?.role_name,
        role_id: userRole.role_id,
        reason: 'Revoked via admin UI'
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error in revokePlatformRole:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch role permission matrix details (roles, permissions, and current mappings).
 */
export async function getRolePermissionMatrix() {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(user.id, 'can_manage_admin_roles');
    if (!hasPermission) throw new Error('Permission denied');

    const { data: roles, error: rolesError } = await supabase
      .from('platform_admin_roles')
      .select('id, role_key, role_name, description')
      .order('role_name');
    if (rolesError) throw rolesError;

    const { data: permissions, error: permissionsError } = await supabase
      .from('platform_admin_permissions')
      .select('id, permission_key, permission_name, description')
      .order('permission_key');
    if (permissionsError) throw permissionsError;

    const { data: mappings, error: mappingsError } = await supabase
      .from('platform_admin_role_permissions')
      .select('role_id, platform_admin_permissions(permission_key)');
    if (mappingsError) throw mappingsError;

    // Group permissions by role_id
    const rolePermissions = {};
    roles.forEach(r => { rolePermissions[r.id] = []; });
    
    mappings?.forEach(m => {
      if (m.platform_admin_permissions && rolePermissions[m.role_id]) {
        rolePermissions[m.role_id].push(m.platform_admin_permissions.permission_key);
      }
    });

    return { success: true, roles, permissions, rolePermissions };
  } catch (error) {
    console.error('Error in getRolePermissionMatrix:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update permissions for a specific role safely.
 */
export async function updateRolePermissions(roleId, permissionKeys) {
  const supabase = await createClient();
  const serviceSupabase = createServiceSupabaseClient();

  try {
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(caller.id, 'can_manage_admin_roles');
    if (!hasPermission) throw new Error('Permission denied');

    // 1. Fetch the target role details
    const { data: role, error: roleError } = await supabase
      .from('platform_admin_roles')
      .select('role_key, role_name')
      .eq('id', roleId)
      .single();
    if (roleError || !role) throw new Error('Target role not found');

    // 2. Safeguard: Non-super admins cannot weaken super_admin, and in fact NO ONE can edit super_admin
    if (role.role_key === 'super_admin') {
      throw new Error('System protected role: super_admin permissions cannot be modified.');
    }

    // 3. Prevent self-lockout of can_manage_admin_roles if this user only has this one role
    const myRoles = await getCurrentUserAdminRoles(caller.id);
    if (myRoles.includes(role.role_key) && !permissionKeys.includes('can_manage_admin_roles')) {
      throw new Error('Self-lockout protection: You cannot remove the can_manage_admin_roles permission from your own role.');
    }

    // 4. Call the secure RPC
    const { error: rpcError } = await serviceSupabase.rpc('sync_role_permissions', {
      p_role_id: roleId,
      p_permission_keys: permissionKeys
    });
    if (rpcError) throw rpcError;

    // 5. Log the admin action
    await logPlatformAdminAction({
      actorUserId: caller.id,
      actionKey: 'role.permissions_updated',
      targetType: 'role',
      targetId: roleId,
      details: {
        role_key: role.role_key,
        role_name: role.role_name,
        new_permissions: permissionKeys
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error in updateRolePermissions:', error);
    return { success: false, error: error.message };
  }
}
