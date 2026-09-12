'use server';

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { checkAndNotifyVacancyReopened } from './notifications';
import { handleOccupancyChange } from './cache';

/**
 * Recalculate and update the candidate's reputation summary via canonical database RPC.
 * Executed via trusted server-only client (service_role) to protect the RPC from public/browser execution.
 */
export async function refreshCandidateReputation(candidateId) {
  if (!candidateId) return { success: false, error: 'Candidate ID required' };
  
  try {
    const supabaseAdmin = createServiceClient();
    const { data: res, error: rpcErr } = await supabaseAdmin
      .rpc('recalculate_candidate_reputation', { p_candidate_id: candidateId });

    if (rpcErr) throw rpcErr;
    if (res && !res.success) throw new Error(res.message || res.error || 'Failed to recalculate reputation');

    return { success: true, data: res };
  } catch (err) {
    console.error('Error refreshing candidate reputation:', err);
    return { success: false, error: err.message || 'Failed to refresh reputation' };
  }
}

/**
 * Mark a job order as completed and insert feedback.
 */
export async function markJobOrderCompleted({ jobOrderId, feedbackData }) {
  if (!jobOrderId) return { success: false, error: 'Job Order ID is required' };
  if (!feedbackData || !feedbackData.sentiment) {
    return { success: false, error: 'Feedback sentiment is required to complete the engagement' };
  }

  const supabase = await createClient();

  try {
    const { data: res, error: rpcError } = await supabase
      .rpc('mark_job_order_completed', {
        p_job_order_id: jobOrderId,
        p_sentiment: feedbackData.sentiment,
        p_tags: feedbackData.tags || [],
        p_comment: feedbackData.comment || ''
      });

    if (rpcError) throw new Error(rpcError.message);
    if (!res || !res.success) throw new Error(res?.message || res?.error || 'Failed to complete engagement.');

    // Refresh candidate reputation
    if (res.candidate_id) {
      await refreshCandidateReputation(res.candidate_id);
      revalidatePath(`/profile/${res.candidate_id}`);
    }

    if (res.job_id) {
      revalidatePath(`/jobs/my-postings/${res.job_id}/applicants`);
      await checkAndNotifyVacancyReopened(res.job_id);
      await handleOccupancyChange(res.job_id);
    }

    return { success: true };
  } catch (err) {
    console.error('Error marking job order completed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch candidate reputation summary and recent feedback
 */
export async function getCandidateReputation(candidateId) {
  if (!candidateId) return null;
  const supabase = await createClient();

  try {
    const { data: summary } = await supabase
      .from('candidate_reputation_summary')
      .select('*')
      .eq('candidate_id', candidateId)
      .single();

    const { data: feedback } = await supabase
      .from('job_feedback')
      .select('*, companies(name, logo_url)')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      summary: summary || {
        completed_jobs: 0,
        cancelled_jobs: 0,
        completion_rate: 0,
        feedback_count: 0,
        positive_feedback_count: 0,
        negative_feedback_count: 0
      },
      feedback: feedback || []
    };
  } catch (err) {
    console.error('Error getting candidate reputation:', err);
    return null;
  }
}
