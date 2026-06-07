import { createClient } from './supabase-server';

/**
 * Stage Admin-1: Platform Admin Role & Access Control helper functions
 * IMPORTANT: These functions include a temporary legacy fallback to profiles.global_role
 * to ensure backward compatibility during the transition.
 */

/**
 * Helper to fetch a profile's global_role for legacy fallback
 */
async function getLegacyGlobalRole(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data.global_role;
}

/**
 * Get all active platform admin roles for a user
 */
export async function getCurrentUserAdminRoles(userId) {
  if (!userId) return [];
  
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('platform_admin_user_roles')
    .select(`
      role_id,
      platform_admin_roles ( role_key, role_name )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!error && data && data.length > 0) {
    return data.map(ur => ur.platform_admin_roles.role_key);
  }

  // Legacy fallback
  const globalRole = await getLegacyGlobalRole(supabase, userId);
  if (['super_admin', 'admin', 'brand_manager'].includes(globalRole)) {
    return ['super_admin']; 
  }

  return [];
}

/**
 * Get all permissions for a user across all their active roles
 */
export async function getCurrentUserAdminPermissions(userId) {
  if (!userId) return [];

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('platform_admin_user_roles')
    .select(`
      platform_admin_roles (
        platform_admin_role_permissions (
          platform_admin_permissions ( permission_key )
        )
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!error && data && data.length > 0) {
    const permissions = new Set();
    data.forEach(ur => {
      const rolePerms = ur.platform_admin_roles?.platform_admin_role_permissions || [];
      rolePerms.forEach(rp => {
        if (rp.platform_admin_permissions?.permission_key) {
          permissions.add(rp.platform_admin_permissions.permission_key);
        }
      });
    });
    
    if (permissions.size > 0) {
      return Array.from(permissions);
    }
  }

  // Legacy fallback
  const globalRole = await getLegacyGlobalRole(supabase, userId);
  if (['super_admin', 'admin', 'brand_manager'].includes(globalRole)) {
    return ['LEGACY_ALL_PERMISSIONS'];
  }

  return [];
}

/**
 * Check if a user has a specific admin permission
 */
export async function userHasAdminPermission(userId, permissionKey) {
  const permissions = await getCurrentUserAdminPermissions(userId);
  if (permissions.includes('LEGACY_ALL_PERMISSIONS')) {
    return true; // Legacy fallback grants everything
  }
  return permissions.includes(permissionKey);
}

/**
 * Check if a user has ANY of the specified permissions
 */
export async function userHasAnyAdminPermission(userId, permissionKeys) {
  const permissions = await getCurrentUserAdminPermissions(userId);
  if (permissions.includes('LEGACY_ALL_PERMISSIONS')) {
    return true; // Legacy fallback
  }
  return permissionKeys.some(key => permissions.includes(key));
}

/**
 * Check if user is any kind of platform admin
 */
export async function isPlatformAdmin(userId) {
  const roles = await getCurrentUserAdminRoles(userId);
  return roles.length > 0;
}
