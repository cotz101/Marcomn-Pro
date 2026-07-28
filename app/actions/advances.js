'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

/**
 * Helper to get the authenticated user and database client
 */
async function getAuthSession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  return { supabase, user };
}

/**
 * Helper to send notifications inside database transactions
 */
async function sendNotification(supabase, { recipientId, senderId, type, title, body, link }) {
  try {
    await supabase.from('notifications').insert({
      recipient_id: recipientId,
      sender_id: senderId,
      type,
      title,
      body,
      link,
      is_read: false
    });
  } catch (err) {
    console.error('Notification error:', err);
  }
}

/**
 * Phase 3: Applicant requests an advance payment
 */
export async function requestAdvancePayment({ applicationId, amount, applicantNotes }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    // 1. Fetch application, associated job, and any existing advance requests
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*, job:jobs(*)')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError || !application) {
      throw new Error('Application not found');
    }

    // Ownership verification
    if (application.applicant_id !== user.id) {
      throw new Error('Unauthorized: you do not own this application');
    }

    const job = application.job;
    if (!job) {
      throw new Error('Job listing not found');
    }

    // Enable check
    if (!job.advance_payment_enabled) {
      throw new Error('Advance payment is not enabled for this job listing');
    }

    // Status meets threshold verification
    const status = (application.status || '').toLowerCase();
    const threshold = (job.advance_payment_availability || 'shortlisted').toLowerCase();
    let thresholdMet = false;

    if (threshold === 'shortlisted') {
      thresholdMet = ['shortlisted', 'offered', 'accepted'].includes(status);
    } else if (threshold === 'offered') {
      thresholdMet = ['offered', 'accepted'].includes(status);
    } else if (threshold === 'accepted') {
      thresholdMet = ['accepted'].includes(status);
    }

    if (!thresholdMet) {
      throw new Error(`Application status (${application.status}) does not meet the availability threshold (${job.advance_payment_availability})`);
    }

    // Fetch existing requests for this application
    const { data: existingRequests, error: reqError } = await supabase
      .from('job_advance_requests')
      .select('*')
      .eq('application_id', applicationId);

    if (reqError) {
      throw new Error('Failed to query existing advance requests');
    }

    // Calculate maximum advance cap
    const salary = Number(job.salary_numeric || 0);
    let maxEligible = 0;
    if (job.advance_payment_type === 'percentage') {
      maxEligible = (salary * Number(job.advance_payment_value || 0)) / 100;
    } else {
      maxEligible = Number(job.advance_payment_value || 0);
    }
    if (job.advance_payment_max !== null) {
      maxEligible = Math.min(maxEligible, Number(job.advance_payment_max));
    }

    // Calculate already used/pending eligibility
    let totalConfirmed = 0;
    let totalActive = 0;
    let hasActiveOrConfirmed = false;

    for (const r of (existingRequests || [])) {
      if (r.status === 'confirmed') {
        totalConfirmed += Number(r.approved_amount || r.requested_amount || 0);
        hasActiveOrConfirmed = true;
      } else if (['pending', 'countered', 'approved', 'transfer_recorded', 'disputed'].includes(r.status)) {
        totalActive += Number(r.counter_amount !== null ? r.counter_amount : r.requested_amount);
        hasActiveOrConfirmed = true;
      }
    }

    // Verify allowance of multiple requests
    if (!job.advance_payment_allow_multiple && hasActiveOrConfirmed) {
      throw new Error('This listing does not allow multiple advance payment requests, and you already have an active or confirmed request');
    }

    // Validate remaining limit
    const remainingEligibility = Math.max(0, maxEligible - totalConfirmed - totalActive);
    if (amount > remainingEligibility) {
      throw new Error(`Request amount ($${amount}) exceeds your remaining advance eligibility ($${remainingEligibility.toFixed(2)})`);
    }

    // Validate positive amount
    if (amount <= 0) {
      throw new Error('Requested amount must be a positive number');
    }

    // Calculate expiry date
    let expiresAt = null;
    if (job.advance_payment_expiry_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + job.advance_payment_expiry_days);
    }

    // Parse currency from salary range
    let currency = 'USD';
    if (job.salary_range) {
      const parts = job.salary_range.split(' ');
      if (parts.length >= 2) {
        currency = parts[0];
      }
    }

    // 2. Insert the advance request record
    const { data: newRequest, error: insertError } = await supabase
      .from('job_advance_requests')
      .insert({
        job_id: job.id,
        application_id: applicationId,
        applicant_id: user.id,
        requested_amount: amount,
        currency,
        status: 'pending',
        applicant_notes: applicantNotes || null,
        expires_at: expiresAt ? expiresAt.toISOString() : null
      })
      .select()
      .single();

    if (insertError || !newRequest) {
      throw new Error(insertError?.message || 'Failed to submit advance request');
    }

    // 3. Create Audit Log entry
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: newRequest.id,
        job_id: job.id,
        actor_id: user.id,
        action: 'requested',
        previous_status: null,
        new_status: 'pending',
        payload: { requested_amount: amount, applicant_notes: applicantNotes || null }
      });

    revalidatePath('/jobs/my-applications');
    return { success: true, request: newRequest };
  } catch (err) {
    console.error('Error in requestAdvancePayment:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 3: Applicant cancels their pending/countered advance request
 */
export async function cancelAdvanceRequest({ requestId }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    // Fetch request
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    // Verify ownership
    if (req.applicant_id !== user.id) {
      throw new Error('Unauthorized: only the applicant can cancel this request');
    }
    
    // Verify status (can only cancel if pending or countered)
    if (!['pending', 'countered'].includes(req.status)) {
      throw new Error(`Cannot cancel a request that is currently in status: ${req.status}`);
    }
    
    // Update status
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit Log entry
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: req.job_id,
        actor_id: user.id,
        action: 'cancelled',
        previous_status: req.status,
        new_status: 'cancelled',
        payload: { cancelled_at: new Date().toISOString() }
      });
      
    revalidatePath('/jobs/my-applications');
    return { success: true };
  } catch (err) {
    console.error('Error in cancelAdvanceRequest:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 4: Company approves an advance payment request
 */
export async function approveAdvance({ requestId, companyNotes }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    // Fetch request and associated job
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*)')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    const job = req.job;
    if (!job) throw new Error('Job listing not found');
    
    // Authorization Check: Must be the user who posted the job
    const posterId = job.poster_id || job.user_id;
    if (posterId !== user.id) {
      throw new Error('Unauthorized: you are not the publisher of this job listing');
    }
    
    // Status validation
    if (!['pending', 'countered'].includes(req.status)) {
      throw new Error(`Cannot approve a request with status: ${req.status}`);
    }
    
    // Determine approved amount
    const approvedAmount = req.status === 'countered' ? req.counter_amount : req.requested_amount;
    
    // Update request
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'approved',
        approved_amount: approvedAmount,
        company_notes: companyNotes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit log
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: job.id,
        actor_id: user.id,
        action: 'approved',
        previous_status: req.status,
        new_status: 'approved',
        payload: { approved_amount: approvedAmount, company_notes: companyNotes || null }
      });
      
    // Notification to applicant
    await sendNotification(supabase, {
      recipientId: req.applicant_id,
      senderId: user.id,
      type: 'advance.approved',
      title: 'Advance Payment Request Approved',
      body: `Your advance payment request has been approved for $${Number(approvedAmount).toFixed(2)} ${req.currency}. The company will record the offline payment next.`,
      link: '/jobs/my-applications'
    });

    revalidatePath(`/jobs/my-postings/${job.id}/applicants`);
    return { success: true };
  } catch (err) {
    console.error('Error in approveAdvance:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 4: Company rejects an advance payment request
 */
export async function rejectAdvance({ requestId, companyNotes }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*)')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    const job = req.job;
    if (!job) throw new Error('Job listing not found');
    
    // Authorization Check
    const posterId = job.poster_id || job.user_id;
    if (posterId !== user.id) {
      throw new Error('Unauthorized: you are not the publisher of this job listing');
    }
    
    // Status validation
    if (!['pending', 'countered'].includes(req.status)) {
      throw new Error(`Cannot reject a request with status: ${req.status}`);
    }
    
    // Update request
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'rejected',
        company_notes: companyNotes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit log
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: job.id,
        actor_id: user.id,
        action: 'rejected',
        previous_status: req.status,
        new_status: 'rejected',
        payload: { company_notes: companyNotes || null }
      });
      
    revalidatePath(`/jobs/my-postings/${job.id}/applicants`);
    return { success: true };
  } catch (err) {
    console.error('Error in rejectAdvance:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 4: Company counters an advance payment request
 */
export async function counterAdvance({ requestId, counterAmount, companyNotes }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*)')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    const job = req.job;
    if (!job) throw new Error('Job listing not found');
    
    // Authorization Check
    const posterId = job.poster_id || job.user_id;
    if (posterId !== user.id) {
      throw new Error('Unauthorized: you are not the publisher of this job listing');
    }
    
    // Status validation: Can only counter pending requests
    if (req.status !== 'pending') {
      throw new Error(`Cannot counter a request with status: ${req.status}`);
    }
    
    // Validate counter amount
    if (counterAmount <= 0) {
      throw new Error('Counter amount must be a positive number');
    }

    // Calculate maximum advance cap & remaining eligibility on server side
    const salary = Number(job.salary_numeric || 0);
    let maxEligible = 0;
    if (job.advance_payment_type === 'percentage') {
      maxEligible = (salary * Number(job.advance_payment_value || 0)) / 100;
    } else {
      maxEligible = Number(job.advance_payment_value || 0);
    }
    if (job.advance_payment_max !== null) {
      maxEligible = Math.min(maxEligible, Number(job.advance_payment_max));
    }

    // Fetch existing requests for this application
    const { data: existingRequests, error: reqError } = await supabase
      .from('job_advance_requests')
      .select('*')
      .eq('application_id', req.application_id);

    if (reqError) {
      throw new Error('Failed to query existing advance requests');
    }

    let totalConfirmed = 0;
    let totalActive = 0;

    for (const r of (existingRequests || [])) {
      if (r.id === requestId) continue; // Exclude the current request we are countering

      const isExpiredOrCancelled = ['rejected', 'cancelled', 'expired', 'review_closed'].includes(r.status);
      if (r.status === 'confirmed') {
        totalConfirmed += Number(r.approved_amount || r.requested_amount || 0);
      } else if (!isExpiredOrCancelled) {
        totalActive += Number(r.counter_amount !== null ? r.counter_amount : r.requested_amount);
      }
    }

    const remainingEligibility = Math.max(0, maxEligible - totalConfirmed - totalActive);
    if (counterAmount > remainingEligibility) {
      throw new Error(`Counter amount ($${counterAmount}) exceeds the applicant's remaining eligibility ($${remainingEligibility.toFixed(2)})`);
    }
    
    // Update request
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'countered',
        counter_amount: counterAmount,
        company_notes: companyNotes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit log
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: job.id,
        actor_id: user.id,
        action: 'countered',
        previous_status: 'pending',
        new_status: 'countered',
        payload: { counter_amount: counterAmount, company_notes: companyNotes || null }
      });
      
    revalidatePath(`/jobs/my-postings/${job.id}/applicants`);
    return { success: true };
  } catch (err) {
    console.error('Error in counterAdvance:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 4: Applicant accepts the company's counter offer
 */
export async function acceptCounterOffer({ requestId }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*)')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    // Verify candidate ownership
    if (req.applicant_id !== user.id) {
      throw new Error('Unauthorized: only the applicant can accept this counter offer');
    }
    
    // Validate status
    if (req.status !== 'countered') {
      throw new Error(`Cannot accept counter offer when status is: ${req.status}`);
    }
    
    // Update status to approved, approved_amount = counter_amount
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'approved',
        approved_amount: req.counter_amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit Log entry
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: req.job_id,
        actor_id: user.id,
        action: 'counter_accepted',
        previous_status: 'countered',
        new_status: 'approved',
        payload: { approved_amount: req.counter_amount }
      });
      
    // Notification to company
    const job = req.job;
    if (job) {
      const posterId = job.poster_id || job.user_id;
      await sendNotification(supabase, {
        recipientId: posterId,
        senderId: user.id,
        type: 'advance.approved',
        title: 'Counter Offer Accepted',
        body: `The applicant has accepted your counter offer for $${Number(req.counter_amount).toFixed(2)} ${req.currency}. Please record the offline transfer.`,
        link: `/jobs/my-postings/${job.id}/applicants`
      });
    }

    revalidatePath('/jobs/my-applications');
    return { success: true };
  } catch (err) {
    console.error('Error in acceptCounterOffer:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 4: Applicant declines/cancels the company's counter offer
 */
export async function declineCounterOffer({ requestId }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    // Verify candidate ownership
    if (req.applicant_id !== user.id) {
      throw new Error('Unauthorized: only the applicant can decline this counter offer');
    }
    
    // Validate status
    if (req.status !== 'countered') {
      throw new Error(`Cannot decline counter offer when status is: ${req.status}`);
    }
    
    // Update status to cancelled
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit Log entry
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: req.job_id,
        actor_id: user.id,
        action: 'counter_declined',
        previous_status: 'countered',
        new_status: 'cancelled',
        payload: { declined_at: new Date().toISOString() }
      });
      
    revalidatePath('/jobs/my-applications');
    return { success: true };
  } catch (err) {
    console.error('Error in declineCounterOffer:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 5: Company records the transfer of funds (offline transfer recorded)
 */
export async function recordTransfer({ requestId, paymentMethod, amountTransferred, transferDate, referenceNumber, companyNotes, proofUrl }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    // Fetch request and associated job
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*)')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    const job = req.job;
    if (!job) throw new Error('Job listing not found');
    
    // Authorization Check: Must be job owner/poster
    const posterId = job.poster_id || job.user_id;
    if (posterId !== user.id) {
      throw new Error('Unauthorized: you are not the publisher of this job listing');
    }
    
    // Validate status: must be approved
    if (req.status !== 'approved') {
      throw new Error(`Cannot record transfer when status is: ${req.status}`);
    }
    
    // Validate amount: must equal approved_amount
    const approvedAmount = Number(req.approved_amount || 0);
    if (Number(amountTransferred) !== approvedAmount) {
      throw new Error(`Transfer amount ($${amountTransferred}) must match the approved amount ($${approvedAmount.toFixed(2)})`);
    }
    
    // Validate payment method
    const validMethods = ['bank_transfer', 'wise', 'paypal', 'gcash', 'paynow', 'cash', 'other'];
    if (!validMethods.includes(paymentMethod)) {
      throw new Error(`Invalid payment method: ${paymentMethod}`);
    }
    
    // Update request status to transfer_recorded
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'transfer_recorded',
        payment_method: paymentMethod,
        transfer_date: transferDate || new Date().toISOString().split('T')[0],
        reference_number: referenceNumber || null,
        company_notes: companyNotes || null,
        proof_url: proofUrl || null,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit Log entry
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: job.id,
        actor_id: user.id,
        action: 'transfer_recorded',
        previous_status: 'approved',
        new_status: 'transfer_recorded',
        payload: {
          payment_method: paymentMethod,
          transfer_date: transferDate,
          reference_number: referenceNumber,
          amount_transferred: amountTransferred,
          company_notes: companyNotes || null,
          proof_url: proofUrl || null
        }
      });
      
    // Notification to applicant
    await sendNotification(supabase, {
      recipientId: req.applicant_id,
      senderId: user.id,
      type: 'advance.transfer_recorded',
      title: 'Advance Payment Sent',
      body: `The company has recorded an offline payment transfer of $${Number(amountTransferred).toFixed(2)} ${req.currency} via ${paymentMethod.replace('_', ' ')}. Please verify and confirm receipt.`,
      link: '/jobs/my-applications'
    });
    
    revalidatePath(`/jobs/my-postings/${job.id}/applicants`);
    return { success: true };
  } catch (err) {
    console.error('Error in recordTransfer:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 5: Applicant confirms receipt of funds
 */
export async function confirmReceipt({ requestId }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*)')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    // Ownership check: Must be the applicant
    if (req.applicant_id !== user.id) {
      throw new Error('Unauthorized: only the applicant can confirm receipt');
    }
    
    // Status check: Can confirm from transfer_recorded or disputed
    if (!['transfer_recorded', 'disputed'].includes(req.status)) {
      throw new Error(`Cannot confirm receipt when status is: ${req.status}`);
    }
    
    // Update request
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit Log entry
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: req.job_id,
        actor_id: user.id,
        action: 'confirmed',
        previous_status: req.status,
        new_status: 'confirmed',
        payload: { confirmed_at: new Date().toISOString() }
      });
      
    // Notification to company
    const job = req.job;
    if (job) {
      const posterId = job.poster_id || job.user_id;
      const displayAmount = Number(req.approved_amount || req.requested_amount).toFixed(2);
      await sendNotification(supabase, {
        recipientId: posterId,
        senderId: user.id,
        type: 'advance.confirmed',
        title: 'Advance Payment Confirmed',
        body: `The applicant has confirmed receipt of your offline transfer of $${displayAmount} ${req.currency}.`,
        link: `/jobs/my-postings/${job.id}/applicants`
      });
    }
    
    revalidatePath('/jobs/my-applications');
    return { success: true };
  } catch (err) {
    console.error('Error in confirmReceipt:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 5: Applicant disputes/reports issue with recorded transfer
 */
export async function disputeReceipt({ requestId, disputeReason }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    if (!disputeReason || !disputeReason.trim()) {
      throw new Error('Dispute reason is required');
    }
    
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*)')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    // Ownership check: Must be the applicant
    if (req.applicant_id !== user.id) {
      throw new Error('Unauthorized: only the applicant can dispute this transfer');
    }
    
    // Status check: must be transfer_recorded
    if (req.status !== 'transfer_recorded') {
      throw new Error(`Cannot dispute request when status is: ${req.status}`);
    }
    
    // Update request
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'disputed',
        dispute_reason: disputeReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit Log entry
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: req.job_id,
        actor_id: user.id,
        action: 'disputed',
        previous_status: 'transfer_recorded',
        new_status: 'disputed',
        payload: { dispute_reason: disputeReason }
      });
      
    // Notification to company
    const job = req.job;
    if (job) {
      const posterId = job.poster_id || job.user_id;
      const displayAmount = Number(req.approved_amount || req.requested_amount).toFixed(2);
      await sendNotification(supabase, {
        recipientId: posterId,
        senderId: user.id,
        type: 'advance.disputed',
        title: 'Advance Payment Disputed',
        body: `The applicant has disputed your offline transfer of $${displayAmount} ${req.currency}. Reason: ${disputeReason}`,
        link: `/jobs/my-postings/${job.id}/applicants`
      });
    }
    
    revalidatePath('/jobs/my-applications');
    return { success: true };
  } catch (err) {
    console.error('Error in disputeReceipt:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 5: Admin closes dispute review (Neutral dispute resolution)
 */
export async function closeDisputeAdmin({ requestId, adminNotes }) {
  try {
    const { supabase, user } = await getAuthSession();
    
    // Verify admin role via profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();
      
    if (profileError || !profile || profile.global_role !== 'super_admin') {
      throw new Error('Unauthorized: Admin access required');
    }
    
    const { data: req, error: fetchError } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*)')
      .eq('id', requestId)
      .maybeSingle();
      
    if (fetchError || !req) throw new Error('Request not found');
    
    // Status check: must be disputed
    if (req.status !== 'disputed') {
      throw new Error(`Cannot close dispute review when status is: ${req.status}`);
    }
    
    // Update request to review_closed
    const { error: updateError } = await supabase
      .from('job_advance_requests')
      .update({
        status: 'review_closed',
        company_notes: adminNotes ? `[Admin Note]: ${adminNotes}\n${req.company_notes || ''}` : req.company_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);
      
    if (updateError) throw updateError;
    
    // Audit Log entry
    await supabase
      .from('job_advance_audit_logs')
      .insert({
        request_id: requestId,
        job_id: req.job_id,
        actor_id: user.id,
        action: 'review_closed',
        previous_status: 'disputed',
        new_status: 'review_closed',
        payload: { admin_notes: adminNotes || null }
      });
      
    // Notification to BOTH applicant and company
    const job = req.job;
    if (job) {
      const posterId = job.poster_id || job.user_id;
      const displayAmount = Number(req.approved_amount || req.requested_amount).toFixed(2);
      
      // Notify applicant
      await sendNotification(supabase, {
        recipientId: req.applicant_id,
        senderId: user.id,
        type: 'advance.review_closed',
        title: 'Advance Dispute Review Closed',
        body: `The administrator has completed review and closed the dispute on your advance payment request of $${displayAmount} ${req.currency}.`,
        link: '/jobs/my-applications'
      });
      
      // Notify company
      await sendNotification(supabase, {
        recipientId: posterId,
        senderId: user.id,
        type: 'advance.review_closed',
        title: 'Advance Dispute Review Closed',
        body: `The administrator has completed review and closed the dispute on the advance payment request of $${displayAmount} ${req.currency} for applicant.`,
        link: `/jobs/my-postings/${job.id}/applicants`
      });
    }
    
    revalidatePath('/jobs/my-applications');
    if (job) {
      revalidatePath(`/jobs/my-postings/${job.id}/applicants`);
    }
    return { success: true };
  } catch (err) {
    console.error('Error in closeDisputeAdmin:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Phase 5: Fetch all advance requests for admin review
 */
export async function getAdminAdvanceRequests() {
  try {
    const { supabase, user } = await getAuthSession();
    
    // Verify admin role via profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();
      
    if (profileError || !profile || profile.global_role !== 'super_admin') {
      throw new Error('Unauthorized: Admin access required');
    }
    
    const { data, error } = await supabase
      .from('job_advance_requests')
      .select('*, job:jobs(*), profile:profiles(*)')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return { success: true, requests: data };
  } catch (err) {
    console.error('Error in getAdminAdvanceRequests:', err);
    return { success: false, error: err.message, requests: [] };
  }
}
