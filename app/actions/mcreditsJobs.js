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
  const isEnabled = await getMCreditSetting('mcredit_job_posting_enabled');
  if (!isEnabled) {
    return { feePercent: 0, fee: 0, enabled: false };
  }
  const feePercent = await getMCreditSetting('company_job_posting_fee_percent');
  const salary = Number(salaryNumeric || 0);
  const fee = Number((salary * feePercent / 100).toFixed(2));
  return { feePercent, fee, enabled: true };
}

/**
 * Preview the candidate acceptance fee without deducting.
 */
export async function getCandidateAcceptanceFeePreview(salaryNumeric) {
  const isEnabled = await getMCreditSetting('mcredit_candidate_acceptance_enabled');
  if (!isEnabled) {
    return { feePercent: 0, fee: 0, enabled: false };
  }
  const feePercent = await getMCreditSetting('candidate_acceptance_fee_percent');
  const salary = Number(salaryNumeric || 0);
  const fee = Number((salary * feePercent / 100).toFixed(2));
  return { feePercent, fee, enabled: true };
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
 * Atomically accept a job offer using canonical accept_job_offer RPC.
 * Performs authorization, expiry check, capacity check, monetization debit,
 * application status update to Accepted, and job_orders insertion inside single DB transaction.
 */
export async function acceptCandidateJobOffer(applicationId) {
  try {
    const supabase = await createClient();
    const { data: rpcRes, error: rpcErr } = await supabase
      .rpc('accept_job_offer', { app_id: applicationId });

    if (rpcErr) {
      console.error('accept_job_offer RPC error:', rpcErr);
      return {
        success: false,
        error: 'RPC_ERROR',
        message: rpcErr.message || 'Failed to accept offer.'
      };
    }

    if (!rpcRes || !rpcRes.success) {
      return rpcRes || {
        success: false,
        error: 'UNKNOWN_ERROR',
        message: 'Failed to accept job offer.'
      };
    }

    if (rpcRes.reached_cap && rpcRes.job_id) {
      try {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('poster_id, title')
          .eq('id', rpcRes.job_id)
          .maybeSingle();

        if (jobData?.poster_id) {
          await createPlatformNotification({
            userId: jobData.poster_id,
            title: 'Positions Filled',
            message: `All available positions for this job "${jobData.title}" have now been filled.`,
            type: 'job.filled',
            linkUrl: `/jobs/my-postings`
          });
        }
      } catch (notifErr) {
        console.error('Failed to create positions filled notification:', notifErr);
      }
    }

    if (rpcRes.job_id) {
      await handleOccupancyChange(rpcRes.job_id);
    }

    return rpcRes;
  } catch (err) {
    console.error('acceptCandidateJobOffer error:', err);
    return {
      success: false,
      error: 'SERVER_ERROR',
      message: err.message || 'An unexpected error occurred during acceptance.'
    };
  }
}

/**
 * Backward compatibility wrapper for deductCandidateAcceptanceFee.
 * Delegates to canonical atomic acceptCandidateJobOffer.
 */
export async function deductCandidateAcceptanceFee(candidateId, applicationId, salaryNumeric) {
  const res = await acceptCandidateJobOffer(applicationId);
  if (!res.success) {
    throw new Error(res.message || res.error || 'Failed to accept offer.');
  }
  return res;
}
