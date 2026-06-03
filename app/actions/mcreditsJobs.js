'use server'

import { createClient } from '@/lib/supabase-server';
import {
  getOrCreateUserWallet,
  getOrCreateCompanyWallet,
  getMCreditSetting,
  createWalletTransaction
} from '@/lib/services/mcreditService';

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
    .select('id, status, applicant_id, offer_expires_at, job_id')
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
    // No fee required — just accept
    await supabase
      .from('applications')
      .update({ status: 'Accepted' })
      .eq('id', applicationId);
    return { success: true, fee: 0, message: 'Offer accepted (no fee)' };
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

  // 6. Update application status to Accepted
  const { error: updateError } = await supabase
    .from('applications')
    .update({ status: 'Accepted' })
    .eq('id', applicationId);

  if (updateError) {
    console.error('Failed to update application status after deduction:', updateError);
    // The deduction already happened — log this for manual resolution
    throw new Error('MCredits were deducted but status update failed. Please contact support.');
  }

  return { success: true, fee, newBalance: Number(newBalance) };
}
