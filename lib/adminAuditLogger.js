import { createClient } from '@supabase/supabase-js';

/**
 * Server-only service client bypasses RLS for administrative tasks.
 * Uses SUPABASE_SERVICE_ROLE_KEY which must remain server-side.
 */
function createServiceSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing. Audit logging will fail-safe.');
    return null;
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

/**
 * Stage Admin-4: Platform Admin Audit Logger
 * Log sensitive financial or access management actions to platform_admin_audit_logs.
 * Bypasses RLS utilizing the service role client.
 */
export async function logPlatformAdminAction({ actorUserId, actionKey, targetType, targetId, details }) {
  try {
    const supabase = createServiceSupabaseClient();
    if (!supabase) {
      console.error('Audit log failed-safe: Service client unavailable.');
      return;
    }

    const { error } = await supabase
      .from('platform_admin_audit_logs')
      .insert({
        actor_user_id: actorUserId,
        action_key: actionKey,
        target_type: targetType,
        target_id: targetId ? String(targetId) : null,
        details: details || {}
      });

    if (error) {
      console.error('Database error logging admin action:', error.message);
    }
  } catch (err) {
    console.error('Fail-safe caught error writing admin audit log:', err);
  }
}

/**
 * Fetch recent audit logs (Server action helper, restricted by permission check on caller side).
 */
export async function getRecentAuditLogs(limit = 100) {
  try {
    const supabase = createServiceSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('platform_admin_audit_logs')
      .select(`
        *,
        actor:profiles!platform_admin_audit_logs_actor_user_id_fkey ( name, email )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch admin audit logs:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getRecentAuditLogs:', err);
    return [];
  }
}
