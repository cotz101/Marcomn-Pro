'use server';

import { createClient } from '@/lib/supabase-server';
import { createPlatformNotification } from './notifications';

/**
 * Helper to check if a user is an admin.
 */
async function checkIsAdmin(supabase, userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', userId)
    .single();
    
  if (!profile) return false;
  return ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);
}

/**
 * Create a new top-up request.
 * - Personal (ownerType='user'): instantly credited via SECURITY DEFINER RPC.
 * - Company (ownerType='company'): stays Pending for admin approval.
 */
export async function createTopupRequest({ ownerType, ownerId, amount, remarks }) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    
    if (!amount || Number(amount) <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (ownerType === 'user' && ownerId !== user.id) {
      throw new Error('Unauthorized to request top-up for another user');
    }

    if (ownerType === 'company') {
      const { data: member } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', ownerId)
        .eq('profile_id', user.id)
        .single();
        
      if (!member) {
        throw new Error('Unauthorized to request top-up for this company');
      }
    }

    // ── Personal top-up: instant credit via SECURITY DEFINER RPC ──────────
    if (ownerType === 'user') {
      const { data: result, error: rpcError } = await supabase.rpc('instant_personal_topup', {
        p_requester_id: user.id,
        p_amount: Number(amount),
        p_remarks: remarks || null,
      });

      if (rpcError) throw new Error(`Instant top-up failed: ${rpcError.message}`);
      if (!result) throw new Error('No result returned from instant top-up RPC');

      // Create receipt for instant topup
      try {
        const { createReceiptForTopup } = await import('./mcreditReceipts');
        await createReceiptForTopup({
          topupRequestId: result.request_id,
          transactionId: result.tx_id
        });
      } catch (receiptErr) {
        console.error('Failed to generate receipt for instant topup:', receiptErr);
      }

      return { success: true, instantCredit: true, result };
    }

    // ── Company top-up: insert as Pending, wait for admin approval ─────────
    const { data: request, error: insertError } = await supabase
      .from('mcredit_topup_requests')
      .insert({
        requester_id: user.id,
        owner_type: 'company',
        owner_id: ownerId,
        amount: Number(amount),
        status: 'Pending',
        payment_method: 'dummy_manual',
        remarks: remarks || null,
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    // Send notifications to all admins
    try {
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', ownerId)
        .single();
      const companyName = companyData?.name || 'Company';

      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .in('global_role', ['super_admin', 'admin', 'brand_manager']);

      if (adminProfiles && adminProfiles.length > 0) {
        await Promise.all(
          adminProfiles.map(admin =>
            createPlatformNotification({
              userId: admin.id,
              title: 'New Top-Up Request',
              message: `New company MCredits top-up request submitted by ${companyName}.`,
              type: 'wallet_topup',
              linkUrl: '/admin/mcredits',
              senderId: null
            })
          )
        );
      }
    } catch (notifErr) {
      console.error('Failed to send admin top-up request notifications:', notifErr);
    }
    
    return { success: true, instantCredit: false, request };
  } catch (error) {
    console.error('createTopupRequest error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a pending top-up request.
 */
export async function cancelTopupRequest(requestId) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { data: request, error: fetchError } = await supabase
      .from('mcredit_topup_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) throw new Error('Request not found');

    if (request.status !== 'Pending') {
      throw new Error(`Cannot cancel request that is ${request.status}`);
    }

    // Verify ownership
    if (request.owner_type === 'user' && request.owner_id !== user.id) {
      throw new Error('Unauthorized');
    }
    if (request.owner_type === 'company') {
      const { data: member } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', request.owner_id)
        .eq('profile_id', user.id)
        .single();
      if (!member) throw new Error('Unauthorized');
    }

    const { error: updateError } = await supabase
      .from('mcredit_topup_requests')
      .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (updateError) throw new Error(updateError.message);

    return { success: true };
  } catch (error) {
    console.error('cancelTopupRequest error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Approve a top-up request (Admin only)
 */
export async function approveTopupRequest(requestId, adminNotes) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const isAdmin = await checkIsAdmin(supabase, user.id);
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    // Fetch the request
    const { data: request, error: fetchError } = await supabase
      .from('mcredit_topup_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) throw new Error('Request not found');
    if (request.status !== 'Pending') throw new Error(`Cannot approve request that is ${request.status}`);

    // Get or create wallet using RPC
    const { data: walletId, error: walletError } = await supabase.rpc('get_or_create_wallet', {
      p_owner_type: request.owner_type,
      p_owner_id: request.owner_id,
    });

    if (walletError || !walletId) {
      throw new Error('Failed to resolve wallet for crediting');
    }

    const description = request.owner_type === 'user' 
      ? 'Personal MCredits top-up approved' 
      : 'Company MCredits top-up approved';

    // Credit wallet using RPC
    const { data: txId, error: creditError } = await supabase.rpc('adjust_wallet_balance', {
      p_wallet_id: walletId,
      p_amount: request.amount,
      p_direction: 'credit',
      p_transaction_type: 'purchase_completed', // Try purchase_completed first
      p_justification_note: description,
      p_created_by: user.id,
      p_reference_type: 'mcredit_topup_request',
      p_reference_id: requestId,
      p_override_insufficient: true,
    });

    let finalTxId = txId;
    if (creditError) {
      // Fallback to admin_grant if purchase_completed is not allowed
      if (creditError.message.includes('Invalid transaction_type')) {
        const { data: fallbackTxId, error: fallbackError } = await supabase.rpc('adjust_wallet_balance', {
          p_wallet_id: walletId,
          p_amount: request.amount,
          p_direction: 'credit',
          p_transaction_type: 'admin_grant',
          p_justification_note: description,
          p_created_by: user.id,
          p_reference_type: 'mcredit_topup_request',
          p_reference_id: requestId,
          p_override_insufficient: true,
        });

        if (fallbackError) throw new Error(`Fallback crediting failed: ${fallbackError.message}`);
        finalTxId = fallbackTxId;
      } else {
        throw new Error(`Crediting failed: ${creditError.message}`);
      }
    }

    // Now fetch the actual transaction that was inserted by `adjust_wallet_balance`
    const { data: txList } = await supabase
      .from('mcredit_transactions')
      .select('id')
      .eq('reference_type', 'mcredit_topup_request')
      .eq('reference_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1);
      
    const actualTxId = txList && txList.length > 0 ? txList[0].id : null;

    // Update request
    const { error: updateError } = await supabase
      .from('mcredit_topup_requests')
      .update({
        status: 'Approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
        transaction_id: actualTxId,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw new Error(`Failed to update request: ${updateError.message}`);

    // Create receipt for approved top-up
    try {
      const { createReceiptForTopup } = await import('./mcreditReceipts');
      await createReceiptForTopup({
        topupRequestId: requestId,
        transactionId: actualTxId
      });
    } catch (receiptErr) {
      console.error('Failed to generate receipt for approved company top-up:', receiptErr);
    }

    // Notify requester
    await createPlatformNotification({
      userId: request.requester_id,
      title: 'Top-Up Approved',
      message: `Your MCredits top-up request for ${request.amount} MC has been approved.`,
      type: 'wallet_credit',
      linkUrl: request.owner_type === 'company' ? '/company/wallet' : '/profile/wallet',
      senderId: null
    });

    return { success: true };
  } catch (error) {
    console.error('approveTopupRequest error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject a top-up request (Admin only)
 */
export async function rejectTopupRequest(requestId, adminNotes) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const isAdmin = await checkIsAdmin(supabase, user.id);
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    const { data: request, error: fetchError } = await supabase
      .from('mcredit_topup_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) throw new Error('Request not found');
    if (request.status !== 'Pending') throw new Error(`Cannot reject request that is ${request.status}`);

    const { error: updateError } = await supabase
      .from('mcredit_topup_requests')
      .update({
        status: 'Rejected',
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw new Error(updateError.message);

    // Notify requester
    await createPlatformNotification({
      userId: request.requester_id,
      title: 'Top-Up Rejected',
      message: `Your MCredits top-up request for ${request.amount} MC has been rejected.`,
      type: 'system',
      linkUrl: request.owner_type === 'company' ? '/company/wallet' : '/profile/wallet',
      senderId: null
    });

    return { success: true };
  } catch (error) {
    console.error('rejectTopupRequest error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get top-up requests for a specific owner.
 */
export async function getMyTopupRequests(ownerType, ownerId) {
  const supabase = await createClient();
  try {
    // Calling getUser to ensure the session is properly loaded for RLS
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('mcredit_topup_requests')
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getMyTopupRequests error from DB:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('getMyTopupRequests caught error:', error);
    return [];
  }
}

/**
 * Get all pending top-up requests (Admin only).
 * Returns enriched rows: company name/logo for company requests,
 * requester name/avatar for both.
 */
export async function getPendingTopupRequests() {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const isAdmin = await checkIsAdmin(supabase, user.id);
    if (!isAdmin) return [];

    const { data, error } = await supabase.rpc('get_pending_topup_requests_admin');

    if (error) {
      console.error('getPendingTopupRequests RPC error:', error);
      return [];
    }

    // RPC returns a single jsonb array value
    return data || [];
  } catch (error) {
    console.error('getPendingTopupRequests caught error:', error);
    return [];
  }
}
