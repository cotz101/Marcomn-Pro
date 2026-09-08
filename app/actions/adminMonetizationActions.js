'use server';

import { createClient } from '@/lib/supabase-server';
import { userHasAdminPermission } from '@/lib/adminPermissions';

/**
 * Fetch monetization toggle states.
 */
export async function getMonetizationSettings() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['mcredit_job_posting_enabled', 'mcredit_candidate_acceptance_enabled']);

    if (error) throw error;

    const postingItem = data?.find(s => s.key === 'mcredit_job_posting_enabled');
    const acceptanceItem = data?.find(s => s.key === 'mcredit_candidate_acceptance_enabled');

    return {
      success: true,
      settings: {
        jobPostingEnabled: postingItem ? String(postingItem.value).trim().toLowerCase() !== 'false' : true,
        candidateAcceptanceEnabled: acceptanceItem ? String(acceptanceItem.value).trim().toLowerCase() !== 'false' : true
      }
    };
  } catch (err) {
    console.error('getMonetizationSettings error:', err);
    return {
      success: false,
      error: err.message || 'Failed to fetch monetization settings',
      settings: {
        jobPostingEnabled: true,
        candidateAcceptanceEnabled: true
      }
    };
  }
}

/**
 * Update a monetization setting via security definer RPC with audit logging.
 */
export async function updateMonetizationSettingAction({
  key,
  value,
  reasonCode,
  additionalDetails
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthenticated');

    const canManage = await userHasAdminPermission(user.id, 'can_manage_global_settings');
    if (!canManage) throw new Error('Unauthorized: Permission denied');

    if (!['mcredit_job_posting_enabled', 'mcredit_candidate_acceptance_enabled'].includes(key)) {
      throw new Error('Invalid monetization setting key');
    }

    const stringVal = value ? 'true' : 'false';

    if (reasonCode === 'other' && (!additionalDetails || !additionalDetails.trim())) {
      throw new Error('Additional notes are required when selecting "Other"');
    }

    const { data, error } = await supabase.rpc('update_monetization_setting', {
      p_key: key,
      p_value: stringVal,
      p_reason_code: reasonCode,
      p_additional_details: additionalDetails || null
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Update failed');

    return { success: true, result: data };
  } catch (err) {
    console.error('updateMonetizationSettingAction error:', err);
    return { success: false, error: err.message || 'Failed to update monetization setting' };
  }
}

/**
 * Fetch monetization audit log history (read-only, newest first).
 */
export async function getMonetizationAuditLogs(limit = 50) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthenticated');

    const canView = await userHasAdminPermission(user.id, 'can_manage_global_settings');
    if (!canView) throw new Error('Unauthorized: Permission denied');

    const { data, error } = await supabase
      .from('platform_setting_audit_logs')
      .select('*')
      .in('setting_key', ['mcredit_job_posting_enabled', 'mcredit_candidate_acceptance_enabled'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, logs: data || [] };
  } catch (err) {
    console.error('getMonetizationAuditLogs error:', err);
    return { success: false, error: err.message || 'Failed to fetch audit logs', logs: [] };
  }
}
