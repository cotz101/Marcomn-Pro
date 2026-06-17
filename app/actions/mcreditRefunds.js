'use server';

import { createClient, createServiceClient } from '@/lib/supabase-server';
import Stripe from 'stripe';
import { createPlatformNotification } from './notifications';
import { isPlatformAdmin, userHasAdminPermission } from '@/lib/adminPermissions';
import { logPlatformAdminAction } from '@/lib/adminAuditLogger';

/**
 * Helper to extract or resolve Stripe PaymentIntent ID.
 */
async function resolveStripePaymentIntent(supabase, topupRequest) {
  const paymentRef = topupRequest.payment_reference || '';
  let stripePaymentIntentId = null;

  // 1. If paymentRef is a checkout session, retrieve it from Stripe API
  if (paymentRef.startsWith('cs_')) {
    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey);
        const session = await stripe.checkout.sessions.retrieve(paymentRef);
        if (session && session.payment_intent) {
          stripePaymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id;
        }
      }
    } catch (err) {
      console.error('Failed to retrieve Stripe session for resolving PaymentIntent:', err);
    }
  }

  // 2. Fallback to regex pattern matching in payment_reference or admin_notes
  if (!stripePaymentIntentId) {
    const combinedText = `${paymentRef} ${topupRequest.admin_notes || ''}`;
    const match = combinedText.match(/stripe_payment_intent_id:\s*(pi_[a-zA-Z0-9]+)/);
    if (match) {
      stripePaymentIntentId = match[1];
    }
  }

  // 3. Fallback to direct string if it matches PaymentIntent pattern
  if (!stripePaymentIntentId && paymentRef.startsWith('pi_')) {
    stripePaymentIntentId = paymentRef;
  }

  return stripePaymentIntentId;
}

/**
 * User submits a new refund request.
 */
export async function createRefundRequest({ walletId, topupRequestId, requestedMcredits, reason, userNote }) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    if (!requestedMcredits || Number(requestedMcredits) <= 0) {
      throw new Error('Requested MCredit amount must be greater than 0');
    }

    // 1. Validate wallet existence and ownership/membership
    const { data: wallet, error: walletError } = await supabase
      .from('mcredit_wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (walletError || !wallet) throw new Error('Wallet not found');

    if (wallet.owner_type === 'user' && wallet.owner_id !== user.id) {
      throw new Error('Unauthorized to request refund for this wallet');
    }

    if (wallet.owner_type === 'company') {
      const { data: member } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', wallet.owner_id)
        .eq('profile_id', user.id)
        .single();
      if (!member) {
        throw new Error('Unauthorized to request refund for this company wallet');
      }
    }

    // 2. Duplicate active refund requests prevention
    const { data: existingActive } = await supabase
      .from('mcredit_refund_requests')
      .select('id')
      .eq('topup_request_id', topupRequestId)
      .in('status', ['pending_review', 'processing'])
      .maybeSingle();

    if (existingActive) {
      throw new Error('An active refund request is already processing or under review for this transaction.');
    }

    // 3. Validate original topup request exists and was paid via Stripe
    const { data: topup, error: topupError } = await supabase
      .from('mcredit_topup_requests')
      .select('*')
      .eq('id', topupRequestId)
      .single();

    if (topupError || !topup) throw new Error('Original top-up request not found');
    if (topup.status !== 'Approved') throw new Error('Can only refund fully paid/approved top-ups');
    if (topup.payment_method !== 'stripe') throw new Error('Can only refund top-ups paid via Stripe');

    // 4. Calculate maximum refundable balance remaining for this top-up
    const { data: previousRefunds } = await supabase
      .from('mcredit_refund_requests')
      .select('requested_mcredits')
      .eq('topup_request_id', topupRequestId)
      .in('status', ['pending_review', 'processing', 'approved', 'refunded']);

    const refundedSum = (previousRefunds || []).reduce((acc, r) => acc + Number(r.requested_mcredits), 0);
    const remainingTopupRefundable = Math.max(0, Number(topup.amount) - refundedSum);

    // 5. Capped by current available wallet balance
    const maxRefundable = Math.max(0, Math.min(remainingTopupRefundable, Number(wallet.balance)));

    if (Number(requestedMcredits) > maxRefundable) {
      throw new Error(`Requested refund amount (${requestedMcredits} MC) exceeds the maximum refundable balance of ${maxRefundable.toFixed(2)} MC.`);
    }

    // 6. Resolve Stripe PaymentIntent ID
    const stripePaymentIntentId = await resolveStripePaymentIntent(supabase, topup);

    // 7. Insert the refund request
    const { data: request, error: insertError } = await supabase
      .from('mcredit_refund_requests')
      .insert({
        user_id: user.id,
        company_id: wallet.owner_type === 'company' ? wallet.owner_id : null,
        wallet_id: walletId,
        topup_request_id: topupRequestId,
        stripe_payment_intent_id: stripePaymentIntentId,
        requested_mcredits: Number(requestedMcredits),
        max_refundable_mcredits_snapshot: maxRefundable,
        reason,
        user_note: userNote || null,
        status: 'pending_review'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Send admin notification of new refund request
    try {
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .in('global_role', ['super_admin', 'admin', 'brand_manager']);

      if (adminProfiles && adminProfiles.length > 0) {
        await Promise.all(
          adminProfiles.map(admin =>
            createPlatformNotification({
              userId: admin.id,
              title: 'New Refund Request',
              message: `A new MCredit refund request has been submitted for ${Number(requestedMcredits).toFixed(2)} MC.`,
              type: 'system',
              linkUrl: '/admin/finance',
              senderId: null
            })
          )
        );
      }
    } catch (notifErr) {
      console.error('Failed to notify admins of refund request:', notifErr);
    }

    return { success: true, request };
  } catch (error) {
    console.error('createRefundRequest server action error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all refund requests (Admin only).
 */
export async function getAdminRefundRequests() {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(user.id, 'can_manage_refund_reviews') ||
      await userHasAdminPermission(user.id, 'can_view_wallet_summary');

    if (!hasPermission) throw new Error('Unauthorized admin access');

    // 1. Fetch all refund requests
    const { data: requests, error } = await supabase
      .from('mcredit_refund_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      return { 
        success: true, 
        requests: [], 
        enableStripeRefunds: process.env.ENABLE_MCREDIT_STRIPE_REFUNDS === 'true' 
      };
    }

    // 2. Collect IDs
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
    const companyIds = [...new Set(requests.map(r => r.company_id).filter(Boolean))];
    const topupIds = [...new Set(requests.map(r => r.topup_request_id).filter(Boolean))];

    // 3. Fetch referenced profiles, companies, and top-up requests in parallel
    const [profilesRes, companiesRes, topupsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('profiles').select('id, name, avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] }),
      companyIds.length > 0
        ? supabase.from('companies').select('id, name, logo_url').in('id', companyIds)
        : Promise.resolve({ data: [] }),
      topupIds.length > 0
        ? supabase.from('mcredit_topup_requests').select('id, amount, payment_reference, admin_notes').in('id', topupIds)
        : Promise.resolve({ data: [] })
    ]);

    // 4. Build lookup maps
    const profileMap = {};
    if (profilesRes.data) {
      profilesRes.data.forEach(p => {
        profileMap[p.id] = p;
      });
    }

    const companyMap = {};
    if (companiesRes.data) {
      companiesRes.data.forEach(c => {
        companyMap[c.id] = c;
      });
    }

    const topupMap = {};
    if (topupsRes.data) {
      topupsRes.data.forEach(t => {
        topupMap[t.id] = t;
      });
    }

    // 5. Merge data manually
    const enrichedRequests = requests.map(req => {
      return {
        ...req,
        profile: profileMap[req.user_id] || null,
        company: req.company_id ? (companyMap[req.company_id] || null) : null,
        topup: req.topup_request_id ? (topupMap[req.topup_request_id] || null) : null
      };
    });

    return { 
      success: true, 
      requests: enrichedRequests, 
      enableStripeRefunds: process.env.ENABLE_MCREDIT_STRIPE_REFUNDS === 'true' 
    };
  } catch (error) {
    console.error('getAdminRefundRequests server action error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Admin rejects a refund request.
 */
export async function rejectRefundRequest(requestId, adminNote) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(user.id, 'can_manage_refund_reviews');
    if (!hasPermission) throw new Error('Unauthorized: Missing refund management permission');

    const { data: request, error: fetchError } = await supabase
      .from('mcredit_refund_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) throw new Error('Refund request not found');
    if (request.status !== 'pending_review') {
      throw new Error(`Cannot reject request in status: ${request.status}`);
    }

    const { error: updateError } = await supabase
      .from('mcredit_refund_requests')
      .update({
        status: 'rejected',
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        admin_note: adminNote || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // Notify user of rejection
    await createPlatformNotification({
      userId: request.user_id,
      title: 'Refund Request Rejected',
      message: `Your refund request for ${Number(request.requested_mcredits).toFixed(2)} MC has been rejected.`,
      type: 'system',
      linkUrl: request.company_id ? '/company/wallet' : '/profile/wallet',
      senderId: null
    });

    // Write platform admin audit log
    await logPlatformAdminAction({
      actorUserId: user.id,
      actionKey: 'refund.reject',
      targetType: 'refund_request',
      targetId: requestId,
      details: { admin_note: adminNote || null }
    });

    return { success: true };
  } catch (error) {
    console.error('rejectRefundRequest server action error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Admin approves a refund request (processes deductions and sets status).
 * Note: Under correction 7, we pause actual Stripe execution and simulate successful refund flow
 * to test the state machine, balance deductions, and error safety.
 */
export async function approveRefundRequest(requestId, approvedMcredits, adminNote) {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const hasPermission = await userHasAdminPermission(user.id, 'can_manage_refund_reviews');
    if (!hasPermission) throw new Error('Unauthorized: Missing refund management permission');

    // Safety Gate: Ensure Stripe refund execution is explicitly enabled in environment variables
    if (process.env.ENABLE_MCREDIT_STRIPE_REFUNDS !== 'true') {
      throw new Error('Stripe refund execution is currently disabled.');
    }

    if (!approvedMcredits || Number(approvedMcredits) <= 0) {
      throw new Error('Approved MCredit amount must be greater than 0');
    }

    // 1. Fetch and Lock the request (using service client to bypass RLS for state update)
    const { data: request, error: fetchError } = await serviceSupabase
      .from('mcredit_refund_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) throw new Error('Refund request not found');
    if (request.status !== 'pending_review') {
      throw new Error(`Cannot approve request in status: ${request.status}`);
    }

    // 2. Recheck current available wallet balance and refundable amount
    const { data: wallet, error: walletError } = await serviceSupabase
      .from('mcredit_wallets')
      .select('*')
      .eq('id', request.wallet_id)
      .single();

    if (walletError || !wallet) throw new Error('Wallet not found');

    const { data: topup } = await serviceSupabase
      .from('mcredit_topup_requests')
      .select('*')
      .eq('id', request.topup_request_id)
      .single();

    if (!topup) throw new Error('Original top-up transaction not found');

    const { data: previousRefunds } = await serviceSupabase
      .from('mcredit_refund_requests')
      .select('approved_mcredits')
      .eq('topup_request_id', request.topup_request_id)
      .eq('status', 'refunded');

    const refundedSum = (previousRefunds || []).reduce((acc, r) => acc + Number(r.approved_mcredits || 0), 0);
    const remainingTopupRefundable = Math.max(0, Number(topup.amount) - refundedSum);
    const maxRefundable = Math.max(0, Math.min(remainingTopupRefundable, Number(wallet.balance)));

    if (Number(approvedMcredits) > maxRefundable) {
      throw new Error(`Approved amount (${approvedMcredits} MC) exceeds the live maximum refundable amount of ${maxRefundable.toFixed(2)} MC.`);
    }

    // 3. Deduct approved MCredits immediately from wallet (wallet deduction safety)
    let creditErrorOccurred = false;
    let transactionId = null;

    try {
      const balanceAfter = await serviceSupabase.rpc('adjust_wallet_balance', {
        p_wallet_id: request.wallet_id,
        p_amount: Number(approvedMcredits),
        p_direction: 'debit',
        p_transaction_type: 'refund',
        p_justification_note: `MCredits Refund Approved - Request: ${requestId}`,
        p_created_by: user.id,
        p_reference_type: 'mcredit_refund_request',
        p_reference_id: requestId,
        p_override_insufficient: false
      });

      if (balanceAfter.error) throw new Error(balanceAfter.error.message);

      // Get transaction ID of the deduction
      const { data: transactions } = await serviceSupabase
        .from('mcredit_transactions')
        .select('id')
        .eq('reference_type', 'mcredit_refund_request')
        .eq('reference_id', requestId)
        .order('created_at', { ascending: false })
        .limit(1);

      transactionId = transactions && transactions.length > 0 ? transactions[0].id : null;
    } catch (deductionErr) {
      console.error('Wallet deduction failed:', deductionErr);
      creditErrorOccurred = true;
      throw new Error(`Wallet balance deduction failed: ${deductionErr.message}`);
    }

    // 4. Update request status to 'processing'
    const { error: processingError } = await serviceSupabase
      .from('mcredit_refund_requests')
      .update({
        status: 'processing',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approved_mcredits: Number(approvedMcredits),
        original_transaction_id: transactionId,
        admin_note: adminNote || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (processingError) {
      // Revert deduction
      await serviceSupabase.rpc('adjust_wallet_balance', {
        p_wallet_id: request.wallet_id,
        p_amount: Number(approvedMcredits),
        p_direction: 'credit',
        p_transaction_type: 'refund',
        p_justification_note: `REVERSAL: Refund approval database state update failed`,
        p_created_by: user.id,
        p_reference_type: 'mcredit_refund_request_reversal',
        p_reference_id: requestId,
        p_override_insufficient: true
      });
      throw new Error(`Database update failed: ${processingError.message}`);
    }

    // Calculate USD refund amount based on top-up session info
    const paymentRefText = topup.payment_reference || '';
    const usdAmountMatch = paymentRefText.match(/usd_amount:\s*([0-9.]+)/);
    const originalUsdAmount = usdAmountMatch ? parseFloat(usdAmountMatch[1]) : Number(topup.amount);
    const exchangeRate = Number(topup.amount) / originalUsdAmount;
    const grossUsdRefund = Number(approvedMcredits) / exchangeRate;

    // 5. Stripe Refund Sandbox Integration
    // Under instruction 7, we pause real live Stripe refunds unless key exists.
    // If STRIPE_SECRET_KEY is defined, we execute it.
    let stripeRefundId = null;
    let stripeRefundStatus = null;
    let stripeError = null;

    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (stripeSecretKey && request.stripe_payment_intent_id) {
        const stripe = new Stripe(stripeSecretKey);
        const refundObj = await stripe.refunds.create({
          payment_intent: request.stripe_payment_intent_id,
          amount: Math.round(grossUsdRefund * 100), // in cents
        }, {
          idempotencyKey: `mcredit_refund_request_${requestId}`
        });

        stripeRefundId = refundObj.id;
        stripeRefundStatus = refundObj.status;
      } else {
        // Only allow mock refund success in development/testing environments when keys are not configured.
        // In other environments, throw a missing configuration error.
        const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
        if (isDev) {
          stripeRefundId = `re_mock_${Math.random().toString(36).substring(2, 12)}`;
          stripeRefundStatus = 'succeeded';
        } else {
          throw new Error('Stripe integration is not configured correctly (missing API key or payment intent reference).');
        }
      }
    } catch (err) {
      console.error('Stripe Refund API error:', err);
      stripeError = err.message;
    }

    if (stripeError) {
      // Revert wallet balance immediately (Failure Handling)
      await serviceSupabase.rpc('adjust_wallet_balance', {
        p_wallet_id: request.wallet_id,
        p_amount: Number(approvedMcredits),
        p_direction: 'credit',
        p_transaction_type: 'refund',
        p_justification_note: `REVERSAL: Stripe refund failed: ${stripeError}`,
        p_created_by: user.id,
        p_reference_type: 'mcredit_refund_request_reversal',
        p_reference_id: requestId,
        p_override_insufficient: true
      });

      // Set status to failed
      await serviceSupabase
        .from('mcredit_refund_requests')
        .update({
          status: 'failed',
          admin_note: `Stripe Refund Failed: ${stripeError}. Reverted wallet deduction.`,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      return { success: false, error: `Stripe Refund execution failed: ${stripeError}. Wallet deduction reversed.` };
    }

    // 6. Complete status update to 'refunded'
    const { error: refundDoneError } = await serviceSupabase
      .from('mcredit_refund_requests')
      .update({
        status: 'refunded',
        stripe_refund_id: stripeRefundId,
        stripe_refund_status: stripeRefundStatus,
        gross_refund_amount: grossUsdRefund,
        net_refund_amount: grossUsdRefund, // assuming no platform deduction fee
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (refundDoneError) {
      console.error('Failed to update status to refunded:', refundDoneError);
    }

    // Notify user of successful refund
    await createPlatformNotification({
      userId: request.user_id,
      title: 'Refund Approved and Sent',
      message: `Your refund for ${Number(approvedMcredits).toFixed(2)} MC ($${grossUsdRefund.toFixed(2)} USD) was approved and processed.`,
      type: 'wallet_credit',
      linkUrl: request.company_id ? '/company/wallet' : '/profile/wallet',
      senderId: null
    });

    // Write platform admin audit log
    await logPlatformAdminAction({
      actorUserId: user.id,
      actionKey: 'refund.approve',
      targetType: 'refund_request',
      targetId: requestId,
      details: {
        approved_mcredits: Number(approvedMcredits),
        gross_refund_amount: grossUsdRefund,
        stripe_refund_id: stripeRefundId,
        admin_note: adminNote || null
      }
    });

    return { success: true };
  } catch (error) {
    console.error('approveRefundRequest server action error:', error);
    return { success: false, error: error.message };
  }
}
