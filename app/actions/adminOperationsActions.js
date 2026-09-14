'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUserAdminRoles } from '@/lib/adminPermissions';

/**
 * Verifies if the authenticated caller has Super Admin privileges.
 */
export async function verifySuperAdminOperationsAccess() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { authorized: false, error: 'Unauthorized' };
    }

    const roles = await getCurrentUserAdminRoles(user.id);
    const isSuperAdmin = roles.includes('super_admin');

    if (!isSuperAdmin) {
      return { authorized: false, error: 'Forbidden: Super Admin access required' };
    }

    return { authorized: true, user: { id: user.id, email: user.email } };
  } catch (error) {
    console.error('Error verifying Super Admin operations access:', error);
    return { authorized: false, error: error.message || 'Server error' };
  }
}
