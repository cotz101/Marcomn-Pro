'use server';

import { createClient } from '@/lib/supabase-server';

/**
 * Helper to check if a user is an admin.
 */
async function checkIsAdmin(supabase, userId) {
  // TODO: Integrate with future Role & Access Control system when implemented.
  const { data: profile } = await supabase
    .from('profiles')
    .select('global_role')
    .eq('id', userId)
    .single();
    
  if (!profile) return false;
  return ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);
}

/**
 * Fetch MCredits movement, top-up counts/amounts, and platform revenues.
 */
export async function getFinanceDashboardSummary(filters = {}) {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const isAdmin = await checkIsAdmin(supabase, user.id);
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    // 1. Fetch transactions filtered by date and owner type
    let query = supabase
      .from('mcredit_transactions')
      .select(`
        *,
        wallet:mcredit_wallets!inner (
          id,
          owner_type,
          owner_id
        )
      `);

    if (filters.dateFrom) {
      query = query.gte('created_at', new Date(filters.dateFrom).toISOString());
    }
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      query = query.lte('created_at', dateTo.toISOString());
    }
    if (filters.ownerType && filters.ownerType !== 'all') {
      query = query.eq('wallet.owner_type', filters.ownerType);
    }

    const { data: txs, error: txsError } = await query;
    if (txsError) throw txsError;

    // 2. Fetch top-up requests for statistics
    let topupQuery = supabase
      .from('mcredit_topup_requests')
      .select('*');

    if (filters.dateFrom) {
      topupQuery = topupQuery.gte('created_at', new Date(filters.dateFrom).toISOString());
    }
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      topupQuery = topupQuery.lte('created_at', dateTo.toISOString());
    }
    if (filters.ownerType && filters.ownerType !== 'all') {
      if (filters.ownerType === 'platform') {
        topupQuery = topupQuery.eq('owner_type', 'platform_dummy');
      } else {
        topupQuery = topupQuery.eq('owner_type', filters.ownerType);
      }
    }

    const { data: topups, error: topupsError } = await topupQuery;
    if (topupsError) throw topupsError;

    // 3. Compute summary statistics
    let totalCreditsIn = 0;
    let totalCreditsOut = 0;
    let totalJobPostingFees = 0;
    let totalApplicantAcceptanceFees = 0;
    let totalRefunds = 0;
    let totalPenalties = 0;
    let totalPlatformRevenue = 0;
    let totalAdminGrants = 0;
    let totalAdminDeductions = 0;

    txs?.forEach(tx => {
      const amt = Number(tx.amount || 0);
      if (tx.direction === 'credit') {
        totalCreditsIn += amt;
      } else if (tx.direction === 'debit') {
        totalCreditsOut += amt;
      }

      // Categorize transaction type or reference type
      if (tx.transaction_type === 'spend') {
        if (tx.reference_type === 'job_posting') {
          totalJobPostingFees += amt;
        } else if (tx.reference_type === 'job_application') {
          totalApplicantAcceptanceFees += amt;
        }
      } else if (tx.transaction_type === 'refund') {
        totalRefunds += amt;
      } else if (tx.transaction_type === 'penalty') {
        totalPenalties += amt;
      } else if (tx.transaction_type === 'platform_revenue') {
        totalPlatformRevenue += amt;
      } else if (tx.transaction_type === 'admin_grant') {
        totalAdminGrants += amt;
      } else if (tx.transaction_type === 'admin_deduct') {
        totalAdminDeductions += amt;
      }
    });

    const netMovement = totalCreditsIn - totalCreditsOut;

    // Top-ups stats
    let totalTopupsApproved = 0;
    let totalTopupAmount = 0;
    let totalPendingTopups = 0;
    let totalRejectedTopups = 0;

    topups?.forEach(req => {
      const amt = Number(req.amount || 0);
      if (req.status === 'Approved') {
        totalTopupsApproved += 1;
        totalTopupAmount += amt;
      } else if (req.status === 'Pending') {
        totalPendingTopups += 1;
      } else if (req.status === 'Rejected') {
        totalRejectedTopups += 1;
      }
    });

    return {
      success: true,
      summary: {
        totalCreditsIn,
        totalCreditsOut,
        netMovement,
        totalTopupsApproved,
        totalTopupAmount,
        totalPendingTopups,
        totalRejectedTopups,
        totalJobPostingFees,
        totalApplicantAcceptanceFees,
        totalRefunds,
        totalPenalties,
        totalPlatformRevenue,
        totalAdminGrants,
        totalAdminDeductions,
        transactionCount: txs?.length || 0
      }
    };
  } catch (error) {
    console.error('getFinanceDashboardSummary error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch filtered list of MCredits transactions.
 */
export async function getFinanceTransactions(filters = {}) {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const isAdmin = await checkIsAdmin(supabase, user.id);
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    let query = supabase
      .from('mcredit_transactions')
      .select(`
        *,
        wallet:mcredit_wallets!inner (
          id,
          owner_type,
          owner_id
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.dateFrom) {
      query = query.gte('created_at', new Date(filters.dateFrom).toISOString());
    }
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      query = query.lte('created_at', dateTo.toISOString());
    }
    if (filters.ownerType && filters.ownerType !== 'all') {
      query = query.eq('wallet.owner_type', filters.ownerType);
    }

    // Apply transaction type filters
    if (filters.transactionType && filters.transactionType !== 'all') {
      if (filters.transactionType === 'job_posting_fee') {
        query = query.eq('transaction_type', 'spend').eq('reference_type', 'job_posting');
      } else if (filters.transactionType === 'acceptance_fee') {
        query = query.eq('transaction_type', 'spend').eq('reference_type', 'job_application');
      } else if (filters.transactionType === 'top_up') {
        query = query.eq('transaction_type', 'purchase_completed');
      } else {
        query = query.eq('transaction_type', filters.transactionType);
      }
    }

    const { data: txs, error: txsError } = await query;
    if (txsError) throw txsError;

    // Batch resolve owner details
    const userIds = [];
    const companyIds = [];
    txs?.forEach(tx => {
      if (tx.wallet) {
        if (tx.wallet.owner_type === 'user' && tx.wallet.owner_id) {
          userIds.push(tx.wallet.owner_id);
        } else if (tx.wallet.owner_type === 'company' && tx.wallet.owner_id) {
          companyIds.push(tx.wallet.owner_id);
        }
      }
    });

    const uniqueUserIds = [...new Set(userIds)];
    const uniqueCompanyIds = [...new Set(companyIds)];

    const userMap = {};
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', uniqueUserIds);
      profiles?.forEach(p => {
        userMap[p.id] = p;
      });
    }

    const companyMap = {};
    if (uniqueCompanyIds.length > 0) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .in('id', uniqueCompanyIds);
      companies?.forEach(c => {
        companyMap[c.id] = c;
      });
    }

    // Enrich transactions
    const enrichedTxs = txs?.map(tx => {
      let ownerName = 'Unknown';
      let ownerAvatar = null;
      let ownerType = tx.wallet?.owner_type || 'unknown';

      if (ownerType === 'platform') {
        ownerName = 'MarComn Platform';
      } else if (ownerType === 'user' && tx.wallet?.owner_id) {
        const profile = userMap[tx.wallet.owner_id];
        ownerName = profile?.name || 'Personal Wallet';
        ownerAvatar = profile?.avatar_url || null;
      } else if (ownerType === 'company' && tx.wallet?.owner_id) {
        const company = companyMap[tx.wallet.owner_id];
        ownerName = company?.name || 'Company Wallet';
        ownerAvatar = company?.logo_url || null;
      }

      return {
        id: tx.id,
        created_at: tx.created_at,
        transaction_type: tx.transaction_type,
        direction: tx.direction,
        amount: tx.amount,
        description: tx.justification_note || tx.description || '',
        reference_type: tx.reference_type,
        reference_id: tx.reference_id,
        balance_after: tx.balance_after,
        owner_name: ownerName,
        owner_avatar: ownerAvatar,
        owner_type: ownerType
      };
    }) || [];

    return { success: true, transactions: enrichedTxs };
  } catch (error) {
    console.error('getFinanceTransactions error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch top-up statistics and request items.
 */
export async function getTopupReport(filters = {}) {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const isAdmin = await checkIsAdmin(supabase, user.id);
    if (!isAdmin) throw new Error('Unauthorized: Admin access required');

    let query = supabase
      .from('mcredit_topup_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.dateFrom) {
      query = query.gte('created_at', new Date(filters.dateFrom).toISOString());
    }
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      query = query.lte('created_at', dateTo.toISOString());
    }
    if (filters.ownerType && filters.ownerType !== 'all') {
      if (filters.ownerType === 'platform') {
        query = query.eq('owner_type', 'platform_dummy');
      } else {
        query = query.eq('owner_type', filters.ownerType);
      }
    }

    const { data: requests, error } = await query;
    if (error) throw error;

    let totalPending = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalCancelled = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let userApprovedCount = 0;
    let userApprovedAmount = 0;
    let companyApprovedCount = 0;
    let companyApprovedAmount = 0;
    let companyPendingCount = 0;
    let companyPendingAmount = 0;

    requests?.forEach(req => {
      const amt = Number(req.amount || 0);
      if (req.status === 'Approved') {
        totalApproved += 1;
        approvedAmount += amt;
        if (req.owner_type === 'user') {
          userApprovedCount += 1;
          userApprovedAmount += amt;
        } else if (req.owner_type === 'company') {
          companyApprovedCount += 1;
          companyApprovedAmount += amt;
        }
      } else if (req.status === 'Pending') {
        totalPending += 1;
        pendingAmount += amt;
        if (req.owner_type === 'company') {
          companyPendingCount += 1;
          companyPendingAmount += amt;
        }
      } else if (req.status === 'Rejected') {
        totalRejected += 1;
      } else if (req.status === 'Cancelled') {
        totalCancelled += 1;
      }
    });

    // Batch resolve owner names
    const userIds = [];
    const companyIds = [];
    requests?.forEach(req => {
      if (req.owner_type === 'user' && req.owner_id) {
        userIds.push(req.owner_id);
      } else if (req.owner_type === 'company' && req.owner_id) {
        companyIds.push(req.owner_id);
      }
      if (req.requester_id) {
        userIds.push(req.requester_id);
      }
    });

    const uniqueUserIds = [...new Set(userIds)];
    const uniqueCompanyIds = [...new Set(companyIds)];

    const userMap = {};
    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', uniqueUserIds);
      profiles?.forEach(p => {
        userMap[p.id] = p;
      });
    }

    const companyMap = {};
    if (uniqueCompanyIds.length > 0) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .in('id', uniqueCompanyIds);
      companies?.forEach(c => {
        companyMap[c.id] = c;
      });
    }

    const enrichedRequests = requests?.map(req => {
      let ownerName = 'Unknown';
      let ownerAvatar = null;
      if (req.owner_type === 'user') {
        const p = userMap[req.owner_id];
        ownerName = p?.name || 'Personal Wallet';
        ownerAvatar = p?.avatar_url || null;
      } else if (req.owner_type === 'company') {
        const c = companyMap[req.owner_id];
        ownerName = c?.name || 'Company Wallet';
        ownerAvatar = c?.logo_url || null;
      }

      const requester = userMap[req.requester_id];

      return {
        ...req,
        owner_name: ownerName,
        owner_avatar: ownerAvatar,
        requester_name: requester?.name || 'Unknown User'
      };
    }) || [];

    return {
      success: true,
      report: {
        totalPending,
        totalApproved,
        totalRejected,
        totalCancelled,
        approvedAmount,
        pendingAmount,
        userApprovedCount,
        userApprovedAmount,
        companyApprovedCount,
        companyApprovedAmount,
        companyPendingCount,
        companyPendingAmount,
        requests: enrichedRequests
      }
    };
  } catch (error) {
    console.error('getTopupReport error:', error);
    return { success: false, error: error.message };
  }
}
