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
 * Deduct company MCredits for posting a job.
 * Called AFTER the job row is inserted (so we have a job ID for the reference).
 */
export async function deductJobPostingFee(companyId, jobId, salaryNumeric) {
  const feePercent = await getMCreditSetting('company_job_posting_fee_percent');
  const salary = Number(salaryNumeric || 0);
  const fee = Number((salary * feePercent / 100).toFixed(2));

  if (fee <= 0) {
    return { success: true, fee: 0, message: 'No fee required' };
  }

  const wallet = await getOrCreateCompanyWallet(companyId);
  
  if (Number(wallet.balance) < fee) {
    throw new Error(`Insufficient MCredits. Required: ${fee.toFixed(2)} MC, Available: ${Number(wallet.balance).toFixed(2)} MC. Please top up or contact platform admin.`);
  }

  const newBalance = await createWalletTransaction({
    walletId: wallet.id,
    type: 'spend',
    amount: fee,
    direction: 'debit',
    justification: `Company job posting fee (${feePercent}% of ${salary}) for job ${jobId}`,
    createdBy: null,
    referenceType: 'job_posting',
    referenceId: jobId,
    overrideBalanceCheck: false
  });

  return { success: true, fee, newBalance: Number(newBalance) };
}

/**
 * Deduct user MCredits for posting a job.
 * Called AFTER the job row is inserted (so we have a job ID for the reference).
 */
export async function deductUserJobPostingFee(userId, jobId, salaryNumeric) {
  const feePercent = await getMCreditSetting('company_job_posting_fee_percent');
  const salary = Number(salaryNumeric || 0);
  const fee = Number((salary * feePercent / 100).toFixed(2));

  if (fee <= 0) {
    return { success: true, fee: 0, message: 'No fee required' };
  }

  const wallet = await getOrCreateUserWallet(userId);
  
  if (Number(wallet.balance) < fee) {
    throw new Error(`Insufficient MCredits. Required: ${fee.toFixed(2)} MC, Available: ${Number(wallet.balance).toFixed(2)} MC. Please top up or contact platform admin.`);
  }

  const newBalance = await createWalletTransaction({
    walletId: wallet.id,
    type: 'spend',
    amount: fee,
    direction: 'debit',
    justification: `Personal job posting fee (${feePercent}% of ${salary}) for job ${jobId}`,
    createdBy: null,
    referenceType: 'job_posting',
    referenceId: jobId,
    overrideBalanceCheck: false
  });

  return { success: true, fee, newBalance: Number(newBalance) };
}

/**
 * Deduct candidate MCredits for accepting a job offer.
 * Validates: offer not expired, not already accepted, sufficient balance.
 */
export async function deductCandidateAcceptanceFee(candidateId, applicationId, salaryNumeric) {
  const supabase = await createClient();

  // 1. Fetch the application to validate state
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, status, applicant_id, offer_expires_at, job_id, jobs(number_of_positions, poster_id, title)')
    .eq('id', applicationId)
    .single();

  if (appError || !application) {
    throw new Error('Application not found.');
  }

  // Security: ensure this is the actual applicant
  if (application.applicant_id !== candidateId) {
    throw new Error('You are not authorized to accept this offer.');
  }

  // Duplicate guard: already accepted
  if (application.status === 'Accepted') {
    throw new Error('This offer has already been accepted.');
  }

  // Must be in Offered status
  if (application.status !== 'Offered') {
    throw new Error(`Cannot accept offer. Current status: ${application.status}`);
  }

  // Expiry check
  if (application.offer_expires_at) {
    const expiresAt = new Date(application.offer_expires_at);
    if (new Date() > expiresAt) {
      // Mark as expired
      await supabase
        .from('applications')
        .update({ status: 'Expired' })
        .eq('id', applicationId);
      throw new Error('This offer has expired and can no longer be accepted.');
    }
  }

  // Pre-validate capacity dynamically
  const { count: filledCount, error: countErr } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', application.job_id)
    .in('status', ['Accepted', 'Completed']);

  if (countErr) {
    throw new Error('Error verifying current filled positions.');
  }

  const number_of_positions = application.jobs?.number_of_positions || 1;
  if (filledCount >= number_of_positions) {
    throw new Error('All positions for this job are already filled.');
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
      throw new Error(rpcRes?.message || 'Failed to accept offer.');
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
    throw new Error(rpcRes?.message || 'Failed to accept offer. Capacity may have been reached.');
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
}
