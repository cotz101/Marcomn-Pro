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
    
    // Fetch job order
    const { data: order, error: orderError } = await supabase
      .from('job_orders')
      .select('*, job:jobs(title, poster_id, company)')
      .eq('id', jobOrderId)
      .maybeSingle();
      
    if (orderError || !order) throw new Error(`Job order not found for id: ${jobOrderId}`);
    
    // Verify company/poster identity
    if (order.job.poster_id !== user.id) {
      throw new Error('Unauthorized: only the job poster can perform this action');
    }
    
    // Validate status sequence
    if (order.status !== 'Work Completed by Applicant') {
      throw new Error(`Invalid status transition. Current status: ${order.status}`);
    }
    
    // Update
    const { error: updateError } = await supabase
      .from('job_orders')
      .update({
        status: 'Completion Confirmed by Company',
        completion_confirmed_by_company_at: new Date().toISOString(),
        company_completion_note: note || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobOrderId);
      
    if (updateError) throw updateError;
    
    const companyName = order.job.company || 'Company';
    
    // Notify candidate
    await createPlatformNotification({
      userId: order.candidate_id,
      title: 'Work Completion Confirmed',
      message: `${companyName} confirmed work completed for ${order.job.title}. Please confirm payment once received.`,
      type: 'active_engagement',
      linkUrl: `/jobs/my-applications`,
      senderId: user.id
    });
    
    revalidatePath(`/jobs/my-applications`);
    revalidatePath(`/jobs/my-postings/${order.job_id}/applicants`);
    
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
    
    // Fetch job order
    const { data: order, error: orderError } = await supabase
      .from('job_orders')
      .select('*, job:jobs(title, poster_id)')
      .eq('id', jobOrderId)
      .maybeSingle();
      
    if (orderError || !order) throw new Error(`Job order not found for id: ${jobOrderId}`);
    
    // Verify company/poster identity
    if (order.job.poster_id !== user.id) {
      throw new Error('Unauthorized: only the job poster can perform this action');
    }
    
    // Validate status sequence
    if (order.status !== 'Payment Confirmed by Applicant') {
      throw new Error(`Invalid status transition. Current status: ${order.status}`);
    }
    
    // 1. Update job_orders status to 'Completed'
    const { error: updateOrderErr } = await supabase
      .from('job_orders')
      .update({
        status: 'Completed',
        engagement_closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobOrderId);
      
    if (updateOrderErr) throw updateOrderErr;
    
    // 2. Update application status to 'Completed'
    if (order.application_id) {
      const { error: appErr } = await supabase
        .from('applications')
        .update({ status: 'Completed' })
        .eq('id', order.application_id);
        
      if (appErr) throw appErr;
    }
    
    // 3. Insert Feedback if provided and doesn't already exist
    if (feedbackData && feedbackData.sentiment) {
      const { data: existingFeedback } = await supabase
        .from('job_feedback')
        .select('id')
        .eq('job_order_id', jobOrderId)
        .maybeSingle();
        
      if (!existingFeedback) {
        const { error: feedErr } = await supabase
          .from('job_feedback')
          .insert({
            job_order_id: jobOrderId,
            job_id: order.job_id,
            application_id: order.application_id,
            company_id: order.company_id,
            candidate_id: order.candidate_id,
            feedback_by: user.id,
            feedback_sentiment: feedbackData.sentiment,
            feedback_tags: feedbackData.tags || [],
            feedback_comment: feedbackData.comment || '',
            feedback_context: 'completed_job',
            created_at: new Date().toISOString()
          });
          
        if (feedErr) throw feedErr;
      }
    }
    
    // 4. Refresh candidate reputation
    await refreshCandidateReputation(order.candidate_id);
    
    // 5. Notify candidate
    await createPlatformNotification({
      userId: order.candidate_id,
      title: 'Engagement Closed',
      message: `Engagement for ${order.job.title} has been closed as completed.`,
      type: 'engagement_completed',
      linkUrl: `/jobs/my-applications`,
      senderId: user.id
    });
    
    revalidatePath(`/jobs/my-applications`);
    revalidatePath(`/jobs/my-postings/${order.job_id}/applicants`);
    revalidatePath(`/profile/${order.candidate_id}`);
    
    return { success: true };
  } catch (err) {
    console.error('Error in closeCompletedEngagementByCompany:', err);
    return { success: false, error: err.message };
  }
}
