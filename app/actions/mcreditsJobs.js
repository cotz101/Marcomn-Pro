'use server'

import { createClient } from '@/lib/supabase-server';
import {
  getOrCreateUserWallet,
  getOrCreateCompanyWallet,
  getMCreditSetting,
  createWalletTransaction
} from '@/lib/services/mcreditService';
import { createPlatformNotification } from '@/app/actions/notifications';
import { handleOccupancyChange } from '@/app/actions/cache';

/**
 * Preview the job posting fee without deducting.
 */
export async function getJobPostingFeePreview(salaryNumeric) {
  const feePercent = await getMCreditSetting('company_job_posting_fee_percent');
  const salary = Number(salaryNumeric || 0);
  const fee = Number((salary * feePercent / 100).toFixed(2));
  return { feePercent, fee };
}

/**
 * Preview the candidate acceptance fee without deducting.
 */
export async function getCandidateAcceptanceFeePreview(salaryNumeric) {
  const feePercent = await getMCreditSetting('candidate_acceptance_fee_percent');
  const salary = Number(salaryNumeric || 0);
  const fee = Number((salary * feePercent / 100).toFixed(2));
  return { feePercent, fee };
}

/**
 * Get a company's wallet balance.
 */
export async function getCompanyWalletBalance(companyId) {
  const wallet = await getOrCreateCompanyWallet(companyId);
  return { balance: Number(wallet.balance), walletId: wallet.id };
}

/**
 * Get a user's wallet balance.
 */
export async function getUserWalletBalance(userId) {
  const wallet = await getOrCreateUserWallet(userId);
  return { balance: Number(wallet.balance), walletId: wallet.id };
}

/**
 * Atomically charge the canonical wallet and publish the canonical Draft job.
 * The RPC derives the actor, company, wallet, salary, and fee from database state.
 */
export async function publishJobWithMCredit(jobId, expectedFee) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('publish_job_with_mcredit', {
    p_job_id: jobId,
    p_expected_fee: expectedFee
  });

  if (error) {
    throw new Error(`Atomic job publication failed: ${error.message}`);
  }

  return data;
}

/**
 * Deduct candidate MCredits for accepting a job offer.
 * Validates: offer not expired, not already accepted, sufficient balance.
 */
export async function deductCandidateAcceptanceFee(candidateId, applicationId, salaryNumeric) {
  console.log('[DEBUG-ACCEPT] --------------------------------------------');
  console.log('[DEBUG-ACCEPT] STARTING deductCandidateAcceptanceFee', { candidateId, applicationId, salaryNumeric });

  try {
    console.log('[DEBUG-ACCEPT] Step 1: Initializing Supabase client');
    const supabase = await createClient();
    console.log('[DEBUG-ACCEPT] Supabase client initialized');

    // 1. Fetch the application to validate state
    console.log('[DEBUG-ACCEPT] Step 2: Fetching application from DB');
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, status, applicant_id, offer_expires_at, job_id, jobs(number_of_positions, poster_id, title)')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      console.error('[DEBUG-ACCEPT] App Fetch Error:', appError);
      throw new Error(appError?.message || 'Application not found.');
    }
    console.log('[DEBUG-ACCEPT] Application details fetched successfully:', JSON.stringify(application, null, 2));

    // Security: ensure this is the actual applicant
    console.log('[DEBUG-ACCEPT] Step 3: Checking candidate authorization');
    if (application.applicant_id !== candidateId) {
      throw new Error('You are not authorized to accept this offer.');
    }

    // Duplicate guard: already accepted
    console.log('[DEBUG-ACCEPT] Step 4: Guarding against already accepted status');
    if (application.status === 'Accepted') {
      throw new Error('This offer has already been accepted.');
    }

    // Must be in Offered status
    console.log('[DEBUG-ACCEPT] Step 5: Checking Offered status requirements');
    if (application.status !== 'Offered') {
      throw new Error(`Cannot accept offer. Current status: ${application.status}`);
    }

    // Expiry check
    console.log('[DEBUG-ACCEPT] Step 6: Checking offer expiry limits');
    if (application.offer_expires_at) {
      const expiresAt = new Date(application.offer_expires_at);
      if (new Date() > expiresAt) {
        console.log('[DEBUG-ACCEPT] Offer has expired. Updating DB status to Expired.');
        // Mark as expired
        await supabase
          .from('applications')
          .update({ status: 'Expired' })
          .eq('id', applicationId);
        throw new Error('This offer has expired and can no longer be accepted.');
      }
    }

    // Pre-validate capacity dynamically
    console.log('[DEBUG-ACCEPT] Step 7: Pre-validating capacity dynamically');
    const { count: filledCount, error: countErr } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', application.job_id)
      .in('status', ['Accepted', 'Completed']);

    if (countErr) {
      console.error('[DEBUG-ACCEPT] Capacity Check DB Query Error:', countErr);
      throw new Error('Error verifying current filled positions.');
      throw new Error(`Application status must be Offered to accept. Current status: ${application.status}`);
    }

    // 2. Check for duplicate transaction (idempotency guard)
    const { data: existingTx } = await supabase
      .from('mcredit_transactions')
      .select('id')
      .eq('reference_type', 'job_application')
      .eq('reference_id', applicationId)
      .eq('transaction_type', 'spend')
      .eq('direction', 'debit')
      .limit(1);

    if (existingTx && existingTx.length > 0) {
      throw new Error('A deduction for this offer acceptance has already been processed.');
    }

    // 3. Calculate fee
    const feePercent = await getMCreditSetting('candidate_acceptance_fee_percent');
    const salary = Number(salaryNumeric || 0);
    const fee = Number((salary * feePercent / 100).toFixed(2));

    if (fee <= 0) {
      // No fee required — just accept using RPC
      const { data: rpcRes, error: rpcErr } = await supabase
        .rpc('accept_job_offer', { app_id: applicationId });

      if (rpcErr || (rpcRes && !rpcRes.success)) {
        throw new Error(rpcRes?.message || rpcErr?.message || 'Failed to accept offer.');
      }

      if (rpcRes?.reached_cap) {
        try {
          await createPlatformNotification({
            userId: application.jobs.poster_id,
            title: 'Positions Filled',
            message: `All available positions for this job "${application.jobs.title}" have now been filled.`,
            type: 'job.filled',
            linkUrl: `/jobs/my-postings`
          });
        } catch (notifErr) {
          console.error('Failed to create positions filled notification:', notifErr);
        }
      }

      await handleOccupancyChange(application.job_id);
      return { success: true, fee: 0, message: rpcRes?.message || 'Offer accepted (no fee)' };
    }

    // 4. Check balance
    const wallet = await getOrCreateUserWallet(candidateId);

    if (Number(wallet.balance) < fee) {
      throw new Error(`Insufficient MCredits to accept this offer. Required: ${fee.toFixed(2)} MC, Available: ${Number(wallet.balance).toFixed(2)} MC. Please top up your MCredits before the offer expires.`);
    }

    // 5. Deduct
    const newBalance = await createWalletTransaction({
      walletId: wallet.id,
      type: 'spend',
      amount: fee,
      direction: 'debit',
      justification: `Candidate job offer acceptance fee (${feePercent}% of ${salary}) for application ${applicationId}`,
      createdBy: candidateId,
      referenceType: 'job_application',
      referenceId: applicationId,
      overrideBalanceCheck: false
    });

    // 6. Update application status atomically via RPC
    const { data: rpcRes, error: rpcErr } = await supabase
      .rpc('accept_job_offer', { app_id: applicationId });

    if (rpcErr || (rpcRes && !rpcRes.success)) {
      // Compensating transaction: refund the candidate
      try {
        await createWalletTransaction({
          walletId: wallet.id,
          type: 'refund',
          amount: fee,
          direction: 'credit',
          justification: `Refund for failed job offer acceptance (capacity reached) for application ${applicationId}`,
          createdBy: candidateId,
          referenceType: 'job_application',
          referenceId: applicationId,
          overrideBalanceCheck: true
        });
      } catch (refundErr) {
        console.error('CRITICAL: Refund failed after capacity block:', refundErr);
      }
      throw new Error(rpcRes?.message || rpcErr?.message || 'Failed to accept offer. Capacity may have been reached.');
    }

    if (rpcRes?.reached_cap) {
      try {
        await createPlatformNotification({
          userId: application.jobs.poster_id,
          title: 'Positions Filled',
          message: `All available positions for this job "${application.jobs.title}" have now been filled.`,
          type: 'job.filled',
          linkUrl: `/jobs/my-postings`
        });
      } catch (notifErr) {
        console.error('Failed to create positions filled notification:', notifErr);
      }
    }

    await handleOccupancyChange(application.job_id);
    return { success: true, fee, newBalance: Number(newBalance) };

  } catch (err) {
    console.error('deductCandidateAcceptanceFee error:', err);
    throw err;
  }
}
