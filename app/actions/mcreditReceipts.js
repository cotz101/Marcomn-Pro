'use server';

import { createClient } from '@/lib/supabase-server';

function generateReceiptNumber() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MCR-${yyyy}${mm}${dd}-${randomStr}`;
}

export async function createReceiptForTopup({ topupRequestId, transactionId }) {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');
    
    // Check for existing receipt to ensure idempotency
    let existingQuery = supabase.from('mcredit_receipts').select('*');
    if (topupRequestId && transactionId) {
      existingQuery = existingQuery.or(`topup_request_id.eq.${topupRequestId},transaction_id.eq.${transactionId}`);
    } else if (topupRequestId) {
      existingQuery = existingQuery.eq('topup_request_id', topupRequestId);
    } else if (transactionId) {
      existingQuery = existingQuery.eq('transaction_id', transactionId);
    }
    
    const { data: existingReceipts } = await existingQuery;
    if (existingReceipts && existingReceipts.length > 0) {
      return { success: true, receipt: existingReceipts[0] };
    }
    
    // Fetch details needed for receipt
    let topupData = null;
    let txData = null;
    let ownerType = null;
    let ownerId = null;
    let walletId = null;
    let amount = 0;
    
    if (topupRequestId) {
      const { data: req } = await supabase.from('mcredit_topup_requests').select('*').eq('id', topupRequestId).single();
      if (req) {
         topupData = req;
         ownerType = req.owner_type;
         ownerId = req.owner_id;
         amount = req.amount;
      }
    }
    
    if (transactionId) {
       const { data: tx } = await supabase.from('mcredit_transactions').select('*').eq('id', transactionId).single();
       if (tx) {
         txData = tx;
         walletId = tx.wallet_id;
         // Use tx amount as fallback if topupData not present
         if (!amount) amount = tx.amount;
         
         if (!ownerType) {
           const { data: wallet } = await supabase.from('mcredit_wallets').select('*').eq('id', walletId).single();
           if (wallet) {
             ownerType = wallet.owner_type;
             ownerId = wallet.owner_id;
           }
         }
       }
    }
    
    if (!ownerType || !ownerId) {
      throw new Error('Could not resolve owner for receipt');
    }
    
    if (!walletId) {
      const { data: wallet } = await supabase.from('mcredit_wallets').select('id').eq('owner_type', ownerType).eq('owner_id', ownerId).single();
      if (wallet) walletId = wallet.id;
    }
    
    if (!walletId) throw new Error('Could not resolve wallet');
    
    // Resolve requester details
    let issuedToEmail = null;
    let issuedToName = null;
    let issuedToCompany = null;
    
    let requesterId = topupData?.requester_id;
    if (!requesterId && txData) {
       requesterId = txData.created_by;
    }
    
    if (requesterId) {
       const { data: emailData } = await supabase.rpc('get_user_email', { user_id: requesterId });
       if (emailData) issuedToEmail = emailData;
       
       const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', requesterId).single();
       if (profile) issuedToName = profile.full_name;
    }
    
    if (ownerType === 'company') {
       const { data: company } = await supabase.from('companies').select('name').eq('id', ownerId).single();
       if (company) issuedToCompany = company.name;
    } else {
       if (!issuedToName) {
         const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', ownerId).single();
         if (profile) issuedToName = profile.full_name;
       }
       if (!issuedToEmail && ownerId === user.id) {
         issuedToEmail = user.email;
       }
    }
    
    const { data: newReceipt, error: insertError } = await supabase.from('mcredit_receipts').insert({
      receipt_number: generateReceiptNumber(),
      owner_type: ownerType,
      owner_id: ownerId,
      wallet_id: walletId,
      topup_request_id: topupRequestId || null,
      transaction_id: transactionId || null,
      amount: amount,
      payment_method: topupData?.payment_method || 'dummy_manual',
      issued_to_name: issuedToName,
      issued_to_email: issuedToEmail,
      issued_to_company_name: issuedToCompany,
      status: 'issued'
    }).select().single();
    
    if (insertError) throw new Error(insertError.message);
    
    return { success: true, receipt: newReceipt };
  } catch (error) {
    console.error('createReceiptForTopup error:', error);
    return { success: false, error: error.message };
  }
}

export async function getMyReceipts(ownerType, ownerId) {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('mcredit_receipts')
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .order('issued_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('getMyReceipts error:', error);
    return [];
  }
}

export async function getReceiptById(receiptId) {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('mcredit_receipts')
      .select('*')
      .eq('id', receiptId)
      .single();
      
    if (error) throw error;
    return { success: true, receipt: data };
  } catch (error) {
    console.error('getReceiptById error:', error);
    return { success: false, error: error.message };
  }
}

export async function getAdminReceipts() {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('mcredit_receipts')
      .select('*')
      .order('issued_at', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('getAdminReceipts error:', error);
    return [];
  }
}
