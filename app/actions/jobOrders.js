'use server';

import { createClient } from '@/lib/supabase-server';
import { createPlatformNotification, checkAndNotifyVacancyReopened } from './notifications';
import { handleOccupancyChange } from './cache';
import {
  processCandidateCancellationFinancials,
  processCompanyCancellationFinancials,
} from './refunds';
import { refreshCandidateReputation } from './reputation';

/**
 * Creates an active job order after candidate accepts the offer.
 */
export async function createJobOrderFromAcceptedApplication(applicationId) {
  try {
    const supabase = await createClient();

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
/**
 * Handles candidate cancellation of an active job order.
 */
export async function cancelJobOrderByCandidate({ jobOrderId, reason, remarks }) {
  const supabase = await createClient();

  try {
    const { data: res, error: rpcError } = await supabase
      .rpc('cancel_job_order_by_candidate', {
        p_job_order_id: jobOrderId,
        p_reason: reason,
        p_remarks: remarks || null
      });

    if (rpcError) throw new Error(rpcError.message);
    if (!res || !res.success) throw new Error(res?.message || res?.error || 'Failed to cancel engagement.');

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || res.candidate_id;

    // Create platform notification for job poster/company
    const notificationMessage = `A candidate cancelled an accepted job for ${res.job_title || 'Unknown Job'}. Reason: ${reason}.`;
    
    if (res.poster_id) {
      try {
        await createPlatformNotification({
          userId: res.poster_id,
          title: 'Job Engagement Cancelled',
          message: notificationMessage,
          type: 'job_cancelled',
          linkUrl: `/jobs/my-postings/${res.job_id}/applicants`
        });
      } catch (notifErr) {
        console.error('Failed to create platform notification:', notifErr);
      }
    }

    // Record reputation if safe (Stage 3E preparation)
    try {
      if (userId) await refreshCandidateReputation(userId);
    } catch (repErr) {
      console.error('Failed to refresh candidate reputation:', repErr);
    }

    // Stage 3D-1: Process financial distribution (non-blocking)
    try {
      const finResult = await processCandidateCancellationFinancials(res.order_id);
      if (!finResult.success && !finResult.skipped) {
        console.warn('Financial processing warning (candidate cancel):', finResult.error);
      }
    } catch (finErr) {
      console.error('Financial processing failed (candidate cancel) — cancellation stands:', finErr);
    }

    if (res.job_id) {
      await checkAndNotifyVacancyReopened(res.job_id);
      await handleOccupancyChange(res.job_id);
    }

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

    const { data: res, error: rpcError } = await supabase
      .rpc('cancel_job_order_by_company', {
        p_job_order_id: jobOrderId,
        p_reason: reason,
        p_remarks: remarks || null
      });

    if (rpcError) throw new Error(rpcError.message);
    if (!res || !res.success) throw new Error(res?.message || res?.error || 'Failed to cancel engagement.');

    // Create platform notification for candidate
    const notificationMessage = `The employer cancelled the engagement for ${res.job_title || 'Unknown Job'}.`;
    
    if (res.candidate_id) {
      try {
        await createPlatformNotification({
          userId: res.candidate_id,
          title: 'Job Engagement Cancelled',
          message: notificationMessage,
          type: 'job_cancelled',
          linkUrl: `/jobs/my-applications`
        });
      } catch (notifErr) {
        console.error('Failed to create platform notification:', notifErr);
      }

      try {
        await refreshCandidateReputation(res.candidate_id);
      } catch (repErr) {
        console.error('Failed to refresh candidate reputation:', repErr);
      }
    }

    // Stage 3D-1: Process financial distribution (non-blocking)
    try {
      const finResult = await processCompanyCancellationFinancials(res.order_id);
      if (!finResult.success && !finResult.skipped) {
        console.warn('Financial processing warning (company cancel):', finResult.error);
      }
    } catch (finErr) {
      console.error('Financial processing failed (company cancel) — cancellation stands:', finErr);
    }

    if (res.job_id) {
      await checkAndNotifyVacancyReopened(res.job_id);
      await handleOccupancyChange(res.job_id);
    }

    return { success: true };

  } catch (err) {
    console.error('cancelJobOrderByCompany error:', err);
    return { success: false, error: err.message };
  }
}
