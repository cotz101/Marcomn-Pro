'use server';

import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { userHasAdminPermission } from '@/lib/adminPermissions';

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
 * Fetch filtered platform admin audit logs.
 * Server-side enforced with 'can_view_admin_audit_logs'.
 */
export async function fetchFilteredAuditLogs({ actorEmail, actionKey, targetType, dateFrom, dateTo, limit = 100 }) {
  const supabase = await createClient();
  const serviceSupabase = createServiceSupabaseClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(user.id, 'can_view_admin_audit_logs');
    if (!hasPermission) throw new Error('Permission denied');

    let query = serviceSupabase
      .from('platform_admin_audit_logs')
      .select(`
        id,
        created_at,
        actor_user_id,
        action_key,
        target_type,
        target_id,
        details
      `)
      .order('created_at', { ascending: false });

    if (actionKey) {
      query = query.eq('action_key', actionKey);
    }
    if (targetType) {
      query = query.eq('target_type', targetType);
    }
    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      // Include the entire end date by adding 1 day
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt('created_at', toDate.toISOString());
    }

    // Limit to prevent excessive payload
    const safeLimit = Math.min(parseInt(limit, 10) || 100, 1000);
    query = query.limit(safeLimit);

    const { data: logs, error: logsError } = await query;
    if (logsError) throw logsError;

    // Fetch actor emails from auth.users securely
    const actorIds = [...new Set(logs.map(log => log.actor_user_id))].filter(Boolean);
    const actorEmailMap = {};

    if (actorIds.length > 0) {
      const { data: usersData, error: usersError } = await serviceSupabase
        .from('users') // We might need to query auth.users via RPC or just query users table if there's a public users table
        .select('id, email')
        .in('id', actorIds);
        
      // Supabase js client .from('users') might hit public.users if it exists, 
      // but to get auth.users we'd use serviceSupabase.auth.admin.listUsers()
      // Let's use auth admin api
      try {
        const { data: { users }, error: adminAuthError } = await serviceSupabase.auth.admin.listUsers();
        if (!adminAuthError && users) {
          users.forEach(u => {
            actorEmailMap[u.id] = u.email;
          });
        }
      } catch(err) {
        console.error('Error fetching auth users:', err);
      }
    }

    const hydratedLogs = logs.map(log => ({
      ...log,
      actor_email: actorEmailMap[log.actor_user_id] || 'Unknown User'
    }));

    // Post-filter by actor email if provided
    let finalLogs = hydratedLogs;
    if (actorEmail) {
      finalLogs = finalLogs.filter(log => 
        log.actor_email.toLowerCase().includes(actorEmail.toLowerCase())
      );
    }

    return { success: true, logs: finalLogs };
  } catch (error) {
    console.error('Error in fetchFilteredAuditLogs:', error);
    return { success: false, error: error.message };
  }
}
