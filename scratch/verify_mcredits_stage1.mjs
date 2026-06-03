import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read config from .env.local
const env = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('🚀 Starting MCredits Stage 1 Verification...');

  // 1. Verify Platform settings are seeded
  console.log('\n--- 1. Verification of Platform Settings ---');
  const { data: settings, error: settingsError } = await supabase
    .from('platform_settings')
    .select('*')
    .in('key', ['company_job_posting_fee_percent', 'candidate_acceptance_fee_percent']);

  if (settingsError) {
    console.error('❌ Failed to retrieve settings:', settingsError);
  } else {
    console.log('✅ Settings retrieved successfully:');
    settings.forEach(s => {
      console.log(`   - Key: "${s.key}", Value: "${s.value}"`);
    });
  }

  // 2. Verify platform wallet exists
  console.log('\n--- 2. Verification of Platform Wallet ---');
  const { data: platformWallet, error: platError } = await supabase
    .from('mcredit_wallets')
    .select('*')
    .eq('owner_type', 'platform')
    .single();

  if (platError) {
    console.error('❌ Failed to retrieve platform wallet:', platError);
  } else {
    console.log('✅ Platform wallet is active and initialized:');
    console.log(`   - ID: ${platformWallet.id}`);
    console.log(`   - Balance: ${platformWallet.balance} MCredits`);
    console.log(`   - Status: ${platformWallet.status}`);
  }

  // 3. Verify personal wallet and triggers
  console.log('\n--- 3. Verification of User Wallet & Triggers ---');
  // Get a target profile ID
  const { data: profiles } = await supabase.from('profiles').select('id, name').limit(1);
  if (!profiles || profiles.length === 0) {
    console.log('⚠️ No profiles found to verify.');
    return;
  }
  const testUserId = profiles[0].id;
  console.log(`Using Profile ID: ${testUserId} (${profiles[0].name})`);

  const { data: userWallet, error: userError } = await supabase
    .from('mcredit_wallets')
    .select('*')
    .eq('owner_type', 'user')
    .eq('owner_id', testUserId)
    .single();

  if (userError) {
    console.error('❌ User wallet fetch error:', userError);
  } else {
    console.log('✅ User wallet exists (created via trigger/backfill):');
    console.log(`   - ID: ${userWallet.id}`);
    console.log(`   - Balance: ${userWallet.balance} MCredits`);
  }

  // 4. Test atomic adjustments using RPC function
  console.log('\n--- 4. Testing Atomic Balance Grant via RPC ---');
  const grantAmount = 250.00;
  const justification = 'Test reward grant';
  
  const { data: newBalanceGrant, error: grantError } = await supabase.rpc('adjust_wallet_balance', {
    p_wallet_id: userWallet.id,
    p_amount: grantAmount,
    p_direction: 'credit',
    p_transaction_type: 'admin_grant',
    p_justification_note: justification,
    p_created_by: testUserId // using user id as executor for test
  });

  if (grantError) {
    console.error('❌ Grant RPC failed:', grantError);
  } else {
    console.log(`✅ Grant RPC succeeded. New balance: ${newBalanceGrant} MCredits (Expected: ${Number(userWallet.balance) + grantAmount})`);
  }

  console.log('\n--- 5. Testing Atomic Balance Deduction via RPC ---');
  const deductAmount = 100.00;
  
  const { data: newBalanceDeduct, error: deductError } = await supabase.rpc('adjust_wallet_balance', {
    p_wallet_id: userWallet.id,
    p_amount: deductAmount,
    p_direction: 'debit',
    p_transaction_type: 'admin_deduct',
    p_justification_note: 'Test deduction',
    p_created_by: testUserId
  });

  if (deductError) {
    console.error('❌ Deduct RPC failed:', deductError);
  } else {
    console.log(`✅ Deduct RPC succeeded. New balance: ${newBalanceDeduct} MCredits (Expected: ${Number(newBalanceGrant) - deductAmount})`);
  }

  console.log('\n--- 6. Testing Insufficient Balance Failure ---');
  const excessiveDeduct = 9999.00;
  
  const { data: badResult, error: badError } = await supabase.rpc('adjust_wallet_balance', {
    p_wallet_id: userWallet.id,
    p_amount: excessiveDeduct,
    p_direction: 'debit',
    p_transaction_type: 'spend',
    p_justification_note: 'Test overspend',
    p_created_by: testUserId
  });

  if (badError) {
    console.log('✅ Overspend successfully rejected by database constraint:');
    console.log(`   - Error Message: "${badError.message}"`);
  } else {
    console.error('❌ Error: Database allowed overspend! Balance is now:', badResult);
  }

  // 7. Verify transaction trail logs
  console.log('\n--- 7. Verification of Transaction Audit Logs ---');
  const { data: txs, error: txError } = await supabase
    .from('mcredit_transactions')
    .select('*')
    .eq('wallet_id', userWallet.id)
    .order('created_at', { ascending: false });

  if (txError) {
    console.error('❌ Transaction audit log fetch failed:', txError);
  } else {
    console.log(`✅ Retrieved ${txs.length} transactions in audit history:`);
    txs.forEach((tx, idx) => {
      console.log(`   [${idx + 1}] Type: "${tx.transaction_type}", Dir: "${tx.direction}", Amount: ${tx.amount} MC, Balance: ${tx.balance_before} -> ${tx.balance_after}`);
    });
  }

  console.log('\n✨ Verification complete!');
}

run();
