'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { checkAndNotifyVacancyReopened } from './notifications';
import { handleOccupancyChange } from './cache';

/**
 * Recalculate and update the candidate's reputation summary.
 * - completed_jobs: count of job_orders with status 'Completed' for this candidate
 * - cancelled_jobs: count of job_orders with status 'Candidate Cancelled'
 * - completion_rate: (completed / (completed + cancelled)) * 100
 * - feedback_count: total feedback rows
 * - positive/negative counts
 */
export async function refreshCandidateReputation(candidateId) {
  if (!candidateId) return { success: false, error: 'Candidate ID required' };
  
  const supabase = await createClient();
  try {
    // Get completed jobs
    const { count: completedCount, error: compErr } = await supabase
      .from('job_orders')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidateId)
      .eq('status', 'Completed');
      
    if (compErr) throw compErr;

    // Get candidate cancelled jobs
    const { count: cancelledCount, error: cancErr } = await supabase
      .from('job_orders')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidateId)
      .eq('status', 'Candidate Cancelled');
      
    if (cancErr) throw cancErr;

    // Calculate completion rate
    const totalConsidered = completedCount + cancelledCount;
    let completionRate = 0; // default to 0
    if (totalConsidered > 0) {
      completionRate = Math.round((completedCount / totalConsidered) * 100);
    }

    // Get feedback counts
    const { data: feedbackData, error: feedErr } = await supabase
      .from('job_feedback')
      .select('feedback_sentiment')
      .eq('candidate_id', candidateId);
      
    if (feedErr) throw feedErr;

    const feedbackCount = feedbackData.length;
    const positiveCount = feedbackData.filter(f => f.feedback_sentiment === 'positive').length;
    const negativeCount = feedbackData.filter(f => f.feedback_sentiment === 'negative').length;

    // Upsert into candidate_reputation_summary
    const { error: upsertErr } = await supabase
      .from('candidate_reputation_summary')
      .upsert({
        candidate_id: candidateId,
        completed_jobs: completedCount,
        cancelled_jobs: cancelledCount,
        completion_rate: completionRate,
        feedback_count: feedbackCount,
        positive_feedback_count: positiveCount,
        negative_feedback_count: negativeCount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'candidate_id' });

    if (upsertErr) throw upsertErr;

    return { success: true };
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
