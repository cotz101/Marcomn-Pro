import { createClient as createServerClient } from '@/lib/supabase-server';

// Get client helper
async function getClient(supabaseClient) {
  if (supabaseClient) return supabaseClient;
  return await createServerClient();
}

/**
 * Gets or creates a personal wallet for a user.
 */
export async function getOrCreateUserWallet(userId, supabaseClient = null) {
  const supabase = await getClient(supabaseClient);
  
  // 1. Fetch wallet
  const { data: wallet, error: fetchError } = await supabase
    .from('mcredit_wallets')
    .select('*')
    .eq('owner_type', 'user')
    .eq('owner_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (wallet) {
    return wallet;
  }

  // 2. Insert if not exists (handled gracefully by trigger too, but direct insert is idempotent)
  const { data: newWallet, error: insertError } = await supabase
    .from('mcredit_wallets')
    .insert([
      { owner_type: 'user', owner_id: userId, balance: 0.00, status: 'active' }
    ])
    .select('*')
    .single();

  if (insertError) {
    // If conflict because trigger ran or race condition, fetch again
    if (insertError.code === '23505') {
      const { data: retryWallet } = await supabase
        .from('mcredit_wallets')
        .select('*')
        .eq('owner_type', 'user')
        .eq('owner_id', userId)
        .single();
      if (retryWallet) return retryWallet;
    }
    throw insertError;
  }

  return newWallet;
}

/**
 * Gets or creates a company wallet.
 */
export async function getOrCreateCompanyWallet(companyId, supabaseClient = null) {
  const supabase = await getClient(supabaseClient);
  
  const { data: wallet, error: fetchError } = await supabase
    .from('mcredit_wallets')
    .select('*')
    .eq('owner_type', 'company')
    .eq('owner_id', companyId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (wallet) {
    return wallet;
  }

  const { data: newWallet, error: insertError } = await supabase
    .from('mcredit_wallets')
    .insert([
      { owner_type: 'company', owner_id: companyId, balance: 0.00, status: 'active' }
    ])
    .select('*')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retryWallet } = await supabase
        .from('mcredit_wallets')
        .select('*')
        .eq('owner_type', 'company')
        .eq('owner_id', companyId)
        .single();
      if (retryWallet) return retryWallet;
    }
    throw insertError;
  }

  return newWallet;
}

/**
 * Gets the platform wallet (singleton — owner_id is null, owner_type is 'platform').
 * Creates it if it doesn't exist yet.
 */
export async function getOrCreatePlatformWallet(supabaseClient = null) {
  const supabase = await getClient(supabaseClient);

  const { data: wallet, error: fetchError } = await supabase
    .from('mcredit_wallets')
    .select('*')
    .eq('owner_type', 'platform')
    .is('owner_id', null)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (wallet) return wallet;

  const { data: newWallet, error: insertError } = await supabase
    .from('mcredit_wallets')
    .insert([{ owner_type: 'platform', owner_id: null, balance: 0.00, status: 'active' }])
    .select('*')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retryWallet } = await supabase
        .from('mcredit_wallets')
        .select('*')
        .eq('owner_type', 'platform')
        .is('owner_id', null)
        .single();
      if (retryWallet) return retryWallet;
    }
    throw insertError;
  }

  return newWallet;
}

/**
 * Creates a transaction log and updates wallet balance atomically via RPC.
 */
export async function createWalletTransaction({
  walletId,
  type,
  amount,
  direction,
  justification,
  createdBy,
  referenceType = null,
  referenceId = null,
  overrideBalanceCheck = false
}, supabaseClient = null) {
  const supabase = await getClient(supabaseClient);

  const { data: updatedBalance, error } = await supabase.rpc('adjust_wallet_balance', {
    p_wallet_id: walletId,
    p_amount: Number(amount),
    p_direction: direction,
    p_transaction_type: type,
    p_justification_note: justification,
    p_created_by: createdBy,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
    p_override_insufficient: overrideBalanceCheck
  });

  if (error) {
    throw error;
  }

  return updatedBalance;
}

/**
 * Admin Grant Credits.
 */
export async function adminGrantCredits(walletId, amount, justification, adminUserId, supabaseClient = null) {
  return await createWalletTransaction({
    walletId,
    type: 'admin_grant',
    amount,
    direction: 'credit',
    justification,
    createdBy: adminUserId
  }, supabaseClient);
}

/**
 * Admin Deduct Credits.
 */
export async function adminDeductCredits(walletId, amount, justification, adminUserId, supabaseClient = null) {
  return await createWalletTransaction({
    walletId,
    type: 'admin_deduct',
    amount,
    direction: 'debit',
    justification,
    createdBy: adminUserId
  }, supabaseClient);
}

/**
 * Get Configurable Platform Settings.
 */
export async function getMCreditSetting(key, supabaseClient = null) {
  const supabase = await getClient(supabaseClient);
  
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) {
    // Default Fallbacks
    if (key === 'company_job_posting_fee_percent') return 1;
    if (key === 'candidate_acceptance_fee_percent') return 5;
    if (key === 'candidate_cancellation_company_compensation_percent') return 1;
    if (key === 'candidate_cancellation_platform_percent') return 4;
    if (key === 'company_cancellation_candidate_refund_percent') return 100;
    if (key === 'job_expiry_refund_percent') return 100;
    return null;
  }

  return parseFloat(data.value);
}

/**
 * Calculate posting fee for companies.
 */
export async function calculateCompanyPostingFee(salary, supabaseClient = null) {
  const feePercent = await getMCreditSetting('company_job_posting_fee_percent', supabaseClient);
  const numericSalary = Number(salary || 0);
  return Number((numericSalary * feePercent / 100).toFixed(2));
}

/**
 * Calculate acceptance fee for candidates.
 */
export async function calculateCandidateAcceptanceFee(salary, supabaseClient = null) {
  const feePercent = await getMCreditSetting('candidate_acceptance_fee_percent', supabaseClient);
  const numericSalary = Number(salary || 0);
  return Number((numericSalary * feePercent / 100).toFixed(2));
}
