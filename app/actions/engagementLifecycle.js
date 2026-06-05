'use server';

import { createClient } from '@/lib/supabase-server';
import { createPlatformNotification } from '@/app/actions/notifications';
import { refreshCandidateReputation } from '@/app/actions/reputation';
import { revalidatePath } from 'next/cache';

/**
 * 1. Applicant marks work completed
 */
export async function markWorkCompletedByApplicant(jobOrderId, note) {
  if (!jobOrderId) return { success: false, error: 'Job Order ID is required' };
  
  const supabase = await createClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');
    
    // Fetch job order
    const { data: order, error: orderError } = await supabase
      .from('job_orders')
      .select('*, job:jobs(title, poster_id)')
      .eq('id', jobOrderId)
      .maybeSingle();
      
    if (orderError || !order) throw new Error(`Job order not found for id: ${jobOrderId}`);
    
    // Verify candidate identity
    if (order.candidate_id !== user.id) {
      throw new Error('Unauthorized: only the candidate can perform this action');
    }
    
    // Validate status sequence
    if (order.status !== 'Active') {
      throw new Error(`Invalid status transition. Current status: ${order.status}`);
    }
    
    // Update
    const { error: updateError } = await supabase
      .from('job_orders')
      .update({
        status: 'Work Completed by Applicant',
        work_completed_by_applicant_at: new Date().toISOString(),
        work_completion_note: note || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobOrderId);
      
    if (updateError) throw updateError;
    
    // Get applicant name for notification
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
      
    const applicantName = profile?.name || 'Applicant';
    
    // Notify company/job poster
    await createPlatformNotification({
      userId: order.job.poster_id,
      title: 'Work Marked Completed',
      message: `${applicantName} marked work completed for ${order.job.title}.`,
      type: 'active_engagement',
      linkUrl: `/jobs/my-postings/${order.job_id}/applicants`,
      senderId: user.id
    });
    
    revalidatePath(`/jobs/my-applications`);
    revalidatePath(`/jobs/my-postings/${order.job_id}/applicants`);
    
    return { success: true };
  } catch (err) {
    console.error('Error in markWorkCompletedByApplicant:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Company confirms work completed
 */
export async function confirmWorkCompletedByCompany(jobOrderId, note) {
  if (!jobOrderId) return { success: false, error: 'Job Order ID is required' };
  
  const supabase = await createClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');
    
    // Call the RPC function
    const { data: result, error: rpcError } = await supabase
      .rpc('confirm_work_completed_by_company', {
        p_job_order_id: jobOrderId,
        p_note: note || null
      });

    if (rpcError) {
      console.error('RPC Error in confirmWorkCompletedByCompany:', rpcError);
      throw new Error(`Failed to confirm work completed: ${rpcError.message}`);
    }

    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to confirm work completed');
    }

    // Notify candidate using data from RPC
    await createPlatformNotification({
      userId: result.candidate_id,
      title: 'Work Completion Confirmed',
      message: `${result.company_name} confirmed work completed for ${result.job_title}. Please confirm payment once received.`,
      type: 'active_engagement',
      linkUrl: `/jobs/my-applications`,
      senderId: user.id
    });
    
    revalidatePath(`/jobs/my-postings/${result.job_id}/applicants`);
    revalidatePath(`/jobs/my-applications`);
    
    return { success: true };
  } catch (err) {
    console.error('Error in confirmWorkCompletedByCompany:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Applicant confirms payment received
 */
export async function confirmPaymentReceivedByApplicant(jobOrderId, note) {
  if (!jobOrderId) return { success: false, error: 'Job Order ID is required' };
  
  const supabase = await createClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');
    
    // Fetch job order
    const { data: order, error: orderError } = await supabase
      .from('job_orders')
      .select('*, job:jobs(title, poster_id)')
      .eq('id', jobOrderId)
      .maybeSingle();
      
    if (orderError || !order) throw new Error(`Job order not found for id: ${jobOrderId}`);
    
    // Verify candidate identity
    if (order.candidate_id !== user.id) {
      throw new Error('Unauthorized: only the candidate can perform this action');
    }
    
    // Validate status sequence
    if (order.status !== 'Completion Confirmed by Company') {
      throw new Error(`Invalid status transition. Current status: ${order.status}`);
    }
    
    // Update
    const { error: updateError } = await supabase
      .from('job_orders')
      .update({
        status: 'Payment Confirmed by Applicant',
        payment_confirmed_by_applicant_at: new Date().toISOString(),
        payment_confirmation_note: note || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobOrderId);
      
    if (updateError) throw updateError;
    
    // Get applicant name for notification
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();
      
    const applicantName = profile?.name || 'Applicant';
    
    // Notify company/job poster
    await createPlatformNotification({
      userId: order.job.poster_id,
      title: 'Payment Received Confirmed',
      message: `${applicantName} confirmed payment received for ${order.job.title}.`,
      type: 'active_engagement',
      linkUrl: `/jobs/my-postings/${order.job_id}/applicants`,
      senderId: user.id
    });
    
    revalidatePath(`/jobs/my-applications`);
    revalidatePath(`/jobs/my-postings/${order.job_id}/applicants`);
    
    return { success: true };
  } catch (err) {
    console.error('Error in confirmPaymentReceivedByApplicant:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 4. Company closes the engagement
 */
export async function closeCompletedEngagementByCompany({ jobOrderId, feedbackData }) {
  if (!jobOrderId) return { success: false, error: 'Job Order ID is required' };
  if (!feedbackData || !feedbackData.sentiment) {
    return { success: false, error: 'Feedback sentiment is required to close the engagement' };
  }
  
  const supabase = await createClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');
    
    // Call the RPC function
    const { data: result, error: rpcError } = await supabase
      .rpc('close_completed_engagement_by_company', {
        p_job_order_id: jobOrderId,
        p_sentiment: feedbackData.sentiment,
        p_tags: feedbackData.tags || [],
        p_comment: feedbackData.comment || ''
      });

    if (rpcError) {
      console.error('RPC Error in closeCompletedEngagementByCompany:', rpcError);
      throw new Error(`Failed to close engagement: ${rpcError.message}`);
    }

    if (!result || !result.success) {
      throw new Error(result?.error || 'Failed to close engagement');
    }
    
    // Refresh candidate reputation
    await refreshCandidateReputation(result.candidate_id);
    
    // Notify candidate
    await createPlatformNotification({
      userId: result.candidate_id,
      title: 'Engagement Closed',
      message: `${result.company_name} closed the engagement for ${result.job_title} as completed.`,
      type: 'engagement_completed',
      linkUrl: `/jobs/my-applications`,
      senderId: user.id
    });
    
    revalidatePath(`/jobs/my-applications`);
    revalidatePath(`/jobs/my-postings/${result.job_id}/applicants`);
    revalidatePath(`/profile/${result.candidate_id}`);
    
    return { success: true };
  } catch (err) {
    console.error('Error in closeCompletedEngagementByCompany:', err);
    return { success: false, error: err.message };
  }
}
