'use server';

import { createClient } from '@/lib/supabase-server';
import {
  getMCreditSetting,
} from '@/lib/services/mcreditService';

// ─────────────────────────────────────────────────────────────────────────────
// Reason category mappings
// ─────────────────────────────────────────────────────────────────────────────

const COMPANY_BUSINESS_REASONS = new Set([
  'Position Cancelled',
  'Project Cancelled',
  'Vessel Schedule Changed',
  'Client Requirement Changed',
  'Role No Longer Needed',
  'Budget Issue',
  'Company Internal Reason',
]);

const APPLICANT_FAULT_REASONS = new Set([
  'Candidate No Show',
  'Candidate No Response',
  'Candidate Unreachable',
  'Candidate Failed Requirement',
  'Candidate Misrepresented Information',
  'Candidate Declined After Confirmation',
  'Other Candidate Issue',
]);

export async function classifyCancellationReason(reason) {
  if (COMPANY_BUSINESS_REASONS.has(reason)) return 'company_business';
  if (APPLICANT_FAULT_REASONS.has(reason)) return 'applicant_fault';
  // Fallback: treat unknown company reasons as company_business
  return 'company_business';
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal wallet helper — uses SECURITY DEFINER RPC to bypass RLS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets or creates a wallet by owner_type/owner_id using the
 * SECURITY DEFINER `get_or_create_wallet` RPC, so it works regardless
 * of which user's session is currently authenticated.
 *
 * @param {object} supabase - Supabase client
 * @param {'user'|'company'|'platform'} ownerType
 * @param {string|null} ownerId - UUID or null for platform wallet
 * @returns {string} wallet UUID
 */
async function getWalletId(supabase, ownerType, ownerId = null) {
  const { data: walletId, error } = await supabase.rpc('get_or_create_wallet', {
    p_owner_type: ownerType,
    p_owner_id: ownerId,
  });
  if (error) throw new Error(`get_or_create_wallet failed (${ownerType}/${ownerId}): ${error.message}`);
  if (!walletId) throw new Error(`Wallet ID not returned for (${ownerType}/${ownerId})`);
  return walletId;
}

/**
 * Calls the SECURITY DEFINER adjust_wallet_balance RPC.
 * Valid transaction_type values: admin_grant | admin_deduct | purchase_pending |
 * purchase_completed | spend | refund | adjustment | penalty | platform_revenue
 */
async function creditWallet(supabase, { walletId, type, amount, justification, referenceType, referenceId }) {
  const { data, error } = await supabase.rpc('adjust_wallet_balance', {
    p_wallet_id: walletId,
    p_amount: Number(amount),
    p_direction: 'credit',
    p_transaction_type: type,
    p_justification_note: justification,
    p_created_by: null,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
    p_override_insufficient: true,
  });
  if (error) throw new Error(`adjust_wallet_balance failed (${type}): ${error.message}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Candidate Cancels — Financial Distribution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage 3D-1A: Process financial distribution when a candidate cancels.
 *
 * - Candidate receives NO refund.
 * - Company receives candidate_cancellation_company_compensation_percent of salary.
 * - Platform receives candidate_cancellation_platform_percent of salary.
 *
 * Safe to call multiple times — idempotent.
 */
export async function processCandidateCancellationFinancials(jobOrderId) {
  const supabase = await createClient();

  try {
    // 1. Fetch job_order + job + application
    const { data: order, error: orderError } = await supabase
      .from('job_orders')
      .select('*, job:jobs(*), application:applications(*)')
      .eq('id', jobOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return { success: false, error: `Job order not found: ${orderError?.message}` };
    }

    // 2. Validate state
    if (order.status !== 'Candidate Cancelled') {
      return { success: false, error: `Expected Candidate Cancelled, got ${order.status}` };
    }

    // 3. Fetch the cancellation record
    const { data: cancellation, error: cancelError } = await supabase
      .from('job_cancellations')
      .select('*')
      .eq('job_order_id', jobOrderId)
      .eq('cancelled_by_type', 'candidate')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cancelError || !cancellation) {
      return { success: false, error: `Cancellation record not found: ${cancelError?.message}` };
    }

    // 4. Idempotency check — already processed?
    if (cancellation.refund_processed_at) {
      return { success: true, skipped: true, message: 'Already processed — skipping.' };
    }

    // 5. Read settings
    const companyCompPercent = await getMCreditSetting('candidate_cancellation_company_compensation_percent');
    const platformPercent = await getMCreditSetting('candidate_cancellation_platform_percent');

    const salary = Number(order.job?.salary_numeric || 0);

    if (salary <= 0) {
      // No salary — mark as processed but not_applicable
      await supabase
        .from('job_cancellations')
        .update({
          cancellation_category: 'candidate_cancelled',
          refund_status: 'not_applicable',
          refund_review_required: false,
          refund_processed_at: new Date().toISOString(),
        })
        .eq('id', cancellation.id);
      return { success: true, message: 'No salary defined — no financial movement.' };
    }

    const companyCompAmount = Number((salary * companyCompPercent / 100).toFixed(2));
    const platformAmount = Number((salary * platformPercent / 100).toFixed(2));
    const jobTitle = order.job?.title || 'the job';

    // 6. Credit company wallet using SECURITY DEFINER RPC (bypasses RLS)
    let companyTxId = null;
    if (companyCompAmount > 0 && order.job?.company_id) {
      const companyWalletId = await getWalletId(supabase, 'company', order.job.company_id);
      await creditWallet(supabase, {
        walletId: companyWalletId,
        type: 'penalty',      // 'penalty' = candidate's penalty going to company
        amount: companyCompAmount,
        justification: `Candidate cancellation compensation for "${jobTitle}"`,
        referenceType: 'candidate_cancellation',
        referenceId: cancellation.id,
      });

      // Fetch the created transaction ID
      const { data: companyTx } = await supabase
        .from('mcredit_transactions')
        .select('id')
        .eq('reference_type', 'candidate_cancellation')
        .eq('reference_id', cancellation.id)
        .eq('direction', 'credit')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      companyTxId = companyTx?.id || null;
    }

    // 7. Credit platform wallet using SECURITY DEFINER RPC
    let platformTxId = null;
    if (platformAmount > 0) {
      const platformWalletId = await getWalletId(supabase, 'platform', null);
      await creditWallet(supabase, {
        walletId: platformWalletId,
        type: 'platform_revenue',
        amount: platformAmount,
        justification: `Platform share from candidate cancellation for "${jobTitle}"`,
        referenceType: 'candidate_cancellation_platform',
        referenceId: cancellation.id,
      });

      const { data: platformTx } = await supabase
        .from('mcredit_transactions')
        .select('id')
        .eq('reference_type', 'candidate_cancellation_platform')
        .eq('reference_id', cancellation.id)
        .eq('direction', 'credit')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      platformTxId = platformTx?.id || null;
    }

    // 8. Update cancellation record
    await supabase
      .from('job_cancellations')
      .update({
        cancellation_category: 'candidate_cancelled',
        refund_status: 'not_applicable',
        refund_review_required: false,
        refund_processed_at: new Date().toISOString(),
        company_compensation_transaction_id: companyTxId,
        platform_revenue_transaction_id: platformTxId,
      })
      .eq('id', cancellation.id);

    return {
      success: true,
      companyCompAmount,
      platformAmount,
    };

  } catch (err) {
    console.error('[3D-1] processCandidateCancellationFinancials error:', err.message, err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Company Cancels — Financial Distribution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage 3D-1B: Process financial distribution when a company cancels.
 *
 * - Company/Business reason: candidate acceptance fee auto-refunded.
 * - Applicant-fault reason: NO wallet movement, NO refund, NO review case.
 *   (Future admin dispute flow handled separately.)
 * - Company receives NO refund in either case.
 *
 * Safe to call multiple times — idempotent.
 */
export async function processCompanyCancellationFinancials(jobOrderId) {
  const supabase = await createClient();

  try {
    // 1. Fetch job_order + job + application
    const { data: order, error: orderError } = await supabase
      .from('job_orders')
      .select('*, job:jobs(*), application:applications(*)')
      .eq('id', jobOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return { success: false, error: `Job order not found: ${orderError?.message}` };
    }

    // 2. Validate state
    if (order.status !== 'Company Cancelled') {
      return { success: false, error: `Expected Company Cancelled, got ${order.status}` };
    }

    // 3. Fetch the cancellation record
    const { data: cancellation, error: cancelError } = await supabase
      .from('job_cancellations')
      .select('*')
      .eq('job_order_id', jobOrderId)
      .eq('cancelled_by_type', 'company')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cancelError || !cancellation) {
      return { success: false, error: `Cancellation record not found: ${cancelError?.message}` };
    }

    // 4. Idempotency check — already processed?
    if (cancellation.refund_processed_at) {
      return { success: true, skipped: true, message: 'Already processed — skipping.' };
    }

    // 5. Classify the reason
    const category = await classifyCancellationReason(cancellation.cancellation_reason);

    // 6. Find the candidate's original acceptance fee transaction
    const applicationId = order.application_id;
    const { data: acceptanceTx } = await supabase
      .from('mcredit_transactions')
      .select('id, amount, wallet_id')
      .eq('reference_type', 'job_application')
      .eq('reference_id', applicationId)
      .eq('transaction_type', 'spend')
      .eq('direction', 'debit')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const acceptanceFeeAmount = Number(acceptanceTx?.amount || 0);
    const jobTitle = order.job?.title || 'the job';

    // ── Company/Business Reason → Auto-Refund Candidate ─────────────────────
    if (category === 'company_business') {
      let refundTxId = null;

      if (acceptanceFeeAmount > 0) {
        const refundPercent = await getMCreditSetting('company_cancellation_candidate_refund_percent');
        const refundAmount = Number((acceptanceFeeAmount * refundPercent / 100).toFixed(2));

        if (refundAmount > 0) {
          const candidateWalletId = await getWalletId(supabase, 'user', order.candidate_id);
          await creditWallet(supabase, {
            walletId: candidateWalletId,
            type: 'refund',
            amount: refundAmount,
            justification: `Refund for company-cancelled engagement: "${jobTitle}"`,
            referenceType: 'company_cancellation_refund',
            referenceId: cancellation.id,
          });

          const { data: refundTx } = await supabase
            .from('mcredit_transactions')
            .select('id')
            .eq('reference_type', 'company_cancellation_refund')
            .eq('reference_id', cancellation.id)
            .eq('direction', 'credit')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          refundTxId = refundTx?.id || null;
        }
      }

      // Update cancellation record
      await supabase
        .from('job_cancellations')
        .update({
          cancellation_category: 'company_business',
          refund_status: acceptanceFeeAmount > 0 ? 'auto_refunded' : 'not_applicable',
          refund_review_required: false,
          refund_processed_at: new Date().toISOString(),
          refund_transaction_id: refundTxId,
        })
        .eq('id', cancellation.id);

      return {
        success: true,
        category: 'company_business',
        refundAmount: acceptanceFeeAmount,
      };
    }

    // ── Applicant-Fault Reason → No Refund, No Review Case ──────────────────
    // Per business rules: applicant-fault = no automatic refund, no pending review.
    // Future admin dispute is a separate flow.
    if (category === 'applicant_fault') {
      await supabase
        .from('job_cancellations')
        .update({
          cancellation_category: 'applicant_fault',
          refund_status: 'no_refund',
          refund_review_required: false,
          refund_processed_at: new Date().toISOString(),
        })
        .eq('id', cancellation.id);

      return {
        success: true,
        category: 'applicant_fault',
        message: 'No refund for applicant-fault cancellation.',
      };
    }

    return { success: false, error: `Unknown category: ${category}` };

  } catch (err) {
    console.error('[3D-1] processCompanyCancellationFinancials error:', err.message, err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Get Cancellation Financial Status (UI helper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage 3D-1C: Get the financial status of a cancellation for display.
 */
export async function getCancellationFinancialStatus(jobOrderId) {
  const supabase = await createClient();

  try {
    const { data: cancellation, error } = await supabase
      .from('job_cancellations')
      .select('cancellation_category, refund_status, refund_review_required, refund_processed_at, cancellation_reason, cancellation_remarks')
      .eq('job_order_id', jobOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !cancellation) return null;

    return {
      cancellationCategory: cancellation.cancellation_category,
      refundStatus: cancellation.refund_status,
      refundReviewRequired: cancellation.refund_review_required,
      refundProcessedAt: cancellation.refund_processed_at,
      reason: cancellation.cancellation_reason,
      remarks: cancellation.cancellation_remarks,
    };
  } catch (err) {
    console.error('getCancellationFinancialStatus error:', err);
    return null;
  }
}
