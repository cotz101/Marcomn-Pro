'use server';

import { createClient } from '@/lib/supabase-server';
import { createPlatformNotification } from './notifications';

/**
 * Creates an active job order after candidate accepts the offer.
 */
export async function createJobOrderFromAcceptedApplication(applicationId) {
  const supabase = await createClient();

  try {
    // 1. Fetch application with related job
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*, job:jobs(*)')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError || !application) {
      throw new Error(appError?.message || 'Application not found');
    }

    // 2. Validate status
    if (application.status !== 'Accepted') {
      throw new Error(`Application status must be Accepted to create an order, currently: ${application.status}`);
    }

    // 3. Check for existing job order
    const { data: existingOrder, error: orderCheckError } = await supabase
      .from('job_orders')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (orderCheckError) {
      throw new Error(orderCheckError.message);
    }

    if (existingOrder) {
      return { success: true, order: existingOrder, message: 'Existing order found' };
    }

    // 4. Create job order
    const { data: newOrder, error: insertError } = await supabase
      .from('job_orders')
      .insert({
        job_id: application.job_id,
        application_id: application.id,
        company_id: application.job?.company_id || null,
        candidate_id: application.applicant_id,
        status: 'Active'
      })
      .select('*')
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    return { success: true, order: newOrder };

  } catch (err) {
    console.error('createJobOrderFromAcceptedApplication error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetches the active job order for a given application ID.
 */
export async function getJobOrderForApplication(applicationId) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('job_orders')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) {
      console.error('getJobOrderForApplication error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('getJobOrderForApplication error:', err);
    return null;
  }
}

/**
 * Handles candidate cancellation of an active job order.
 */
export async function cancelJobOrderByCandidate({ jobOrderId, reason, remarks }) {
  const supabase = await createClient();

  try {
    // Authenticate
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('Unauthorized');
    }
    const userId = session.user.id;

    // 1. Fetch job order
    const { data: order, error: orderError } = await supabase
      .from('job_orders')
      .select('*, application:applications(*), job:jobs(*)')
      .eq('id', jobOrderId)
      .maybeSingle();

    if (orderError || !order) {
      throw new Error('Job order not found');
    }

    // Verify candidate identity
    if (order.candidate_id !== userId) {
      throw new Error('Unauthorized: only the candidate can cancel their engagement');
    }

    // Verify status
    if (order.status !== 'Active') {
      throw new Error(`Cannot cancel job order that is ${order.status}`);
    }

    // 2. Insert job_cancellations row
    const { error: cancelInsertError } = await supabase
      .from('job_cancellations')
      .insert({
        job_order_id: order.id,
        job_id: order.job_id,
        application_id: order.application_id,
        cancelled_by: userId,
        cancelled_by_type: 'candidate',
        cancellation_reason: reason,
        cancellation_remarks: remarks || null
      });

    if (cancelInsertError) throw new Error(`Cancellation record error: ${cancelInsertError.message}`);

    // 3. Update job_order.status
    const { error: orderUpdateError } = await supabase
      .from('job_orders')
      .update({ status: 'Candidate Cancelled' })
      .eq('id', order.id);

    if (orderUpdateError) throw new Error(`Order update error: ${orderUpdateError.message}`);

    // 4. Optionally update application status to 'Candidate Cancelled'
    const { error: appUpdateError } = await supabase
      .from('applications')
      .update({ status: 'Candidate Cancelled' })
      .eq('id', order.application_id);
      
    if (appUpdateError) {
        console.error('Warning: Could not update application status to Candidate Cancelled', appUpdateError);
    }

    // 5. Create platform notification for job poster/company
    const notificationMessage = `A candidate cancelled an accepted job for ${order.job?.title || 'Unknown Job'}. Reason: ${reason}.`;
    
    // We send this to the poster_id
    if (order.job?.poster_id) {
        try {
            await createPlatformNotification({
                userId: order.job.poster_id,
                title: 'Job Engagement Cancelled',
                message: notificationMessage,
                type: 'job_cancelled',
                linkUrl: `/jobs/my-postings/${order.job_id}/applicants`
            });
        } catch (notifErr) {
            console.error('Failed to create platform notification:', notifErr);
        }
    }

    // TODO: Send or prepare email notification
    // if existing email infrastructure exists, call it here.

    // Record reputation if safe (Stage 3E preparation)
    // We'll upsert reputation summary safely using Rpc or just ignoring conflicts
    const { error: repError } = await supabase
        .from('candidate_reputation_summary')
        .upsert(
            { candidate_id: userId },
            { onConflict: 'candidate_id' }
        );
        
    // Wait, upserting doesn't automatically increment.
    // For now we just prepare it in schema as requested.

    return { success: true };

  } catch (err) {
    console.error('cancelJobOrderByCandidate error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Stage 3C: Allow company to cancel an engagement
 */
export async function cancelJobOrderByCompany({ jobOrderId, reason, remarks }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;

    // 1. Fetch job order and job to verify ownership
    const { data: order, error: orderError } = await supabase
      .from('job_orders')
      .select('*, job:jobs(*)')
      .eq('id', jobOrderId)
      .maybeSingle();

    if (orderError || !order) {
      throw new Error('Job order not found');
    }

    // Verify company/poster identity
    if (order.job.poster_id !== userId) {
      throw new Error('Unauthorized: only the job poster can cancel this engagement');
    }

    // Verify status
    if (order.status !== 'Active') {
      throw new Error(`Cannot cancel job order that is ${order.status}`);
    }

    // 2. Insert job_cancellations row
    const { error: cancelInsertError } = await supabase
      .from('job_cancellations')
      .insert({
        job_order_id: order.id,
        job_id: order.job_id,
        application_id: order.application_id,
        cancelled_by: userId,
        cancelled_by_type: 'company',
        cancellation_reason: reason,
        cancellation_remarks: remarks || null
      });

    if (cancelInsertError) throw new Error(`Cancellation record error: ${cancelInsertError.message}`);

    // 3. Update job_order.status
    const { error: orderUpdateError } = await supabase
      .from('job_orders')
      .update({ status: 'Company Cancelled' })
      .eq('id', order.id);

    if (orderUpdateError) throw new Error(`Order update error: ${orderUpdateError.message}`);

    // 4. Optionally update application status to 'Company Cancelled'
    const { error: appUpdateError } = await supabase
      .from('applications')
      .update({ status: 'Company Cancelled' })
      .eq('id', order.application_id);
      
    if (appUpdateError) {
        console.error('Warning: Could not update application status to Company Cancelled', appUpdateError);
    }

    // 5. Create platform notification for candidate
    const companyName = order.job.company || 'A company';
    const notificationMessage = `${companyName} cancelled the engagement for ${order.job?.title || 'Unknown Job'}.`;
    
    try {
        await createPlatformNotification({
            userId: order.candidate_id,
            title: 'Job Engagement Cancelled',
            message: notificationMessage,
            type: 'job_cancelled',
            linkUrl: `/jobs/my-applications`
        });
    } catch (notifErr) {
        console.error('Failed to create platform notification:', notifErr);
    }

    return { success: true };

  } catch (err) {
    console.error('cancelJobOrderByCompany error:', err);
    return { success: false, error: err.message };
  }
}

