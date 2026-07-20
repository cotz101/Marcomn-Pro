import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables
const env = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to generate receipt number like the webhook does
function generateReceiptNumber() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MCR-${yyyy}${mm}${dd}-${randomStr}`;
}

async function run() {
  console.log("Starting Webhook Auto-Credit Test...");

  // 1. Get a test company or user to top-up
  // Let's search for an existing wallet or profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, name').limit(1);
  if (pErr || !profiles || profiles.length === 0) {
    console.error("No profiles found to run the test.", pErr);
    return;
  }
  const testUserId = profiles[0].id;
  console.log(`Using test profile: ${profiles[0].name} (${testUserId})`);

  // Get or create wallet balance before test
  const { data: walletId, error: walletErr } = await supabase.rpc('get_or_create_wallet', {
    p_owner_type: 'user',
    p_owner_id: testUserId,
  });

  if (walletErr || !walletId) {
    console.error("Failed to get or create wallet.", walletErr);
    return;
  }

  // Get current balance
  const { data: walletBefore, error: wBeforeErr } = await supabase
    .from('mcredit_wallets')
    .select('balance')
    .eq('id', walletId)
    .single();

  const balanceBefore = walletBefore ? Number(walletBefore.balance) : 0;
  console.log(`Wallet Balance Before: ${balanceBefore} MC`);

  // 2. Insert a simulated pending top-up request
  const usdAmount = 25.50; // Custom amount
  const mcreditsAmount = 25.50; // 1:1 rate
  
  const { data: request, error: reqErr } = await supabase
    .from('mcredit_topup_requests')
    .insert({
      requester_id: testUserId,
      owner_type: 'user',
      owner_id: testUserId,
      amount: mcreditsAmount,
      status: 'Pending',
      payment_method: 'stripe',
      remarks: `Test Stripe custom amount`,
    })
    .select()
    .single();

  if (reqErr || !request) {
    console.error("Failed to insert top-up request.", reqErr);
    return;
  }
  const topupRequestId = request.id;
  console.log(`Inserted pending top-up request ID: ${topupRequestId}`);

  // 3. Simulate checkout.session.completed processing logic from Stripe Webhook
  console.log("Simulating checkout.session.completed event processing...");

  // Fetch top-up request
  const { data: requestDb, error: fetchErr } = await supabase
    .from('mcredit_topup_requests')
    .select('*')
    .eq('id', topupRequestId)
    .maybeSingle();

  if (fetchErr || !requestDb) {
    console.error("Webhook test: top-up request not found in DB.", fetchErr);
    return;
  }

  if (requestDb.status === 'Approved') {
    console.error("Webhook test: request already approved!");
    return;
  }

  // Credit wallet using the same RPC function as the webhook
  const { data: balanceAfterVal, error: creditErr } = await supabase.rpc('adjust_wallet_balance', {
    p_wallet_id: walletId,
    p_amount: Number(mcreditsAmount),
    p_direction: 'credit',
    p_transaction_type: 'purchase_completed',
    p_justification_note: `Stripe Top-Up - USD ${usdAmount}`,
    p_created_by: testUserId,
    p_reference_type: 'stripe_checkout',
    p_reference_id: topupRequestId,
    p_override_insufficient: true,
  });

  if (creditErr) {
    console.error("Webhook test: crediting failed:", creditErr.message);
    return;
  }

  // Get transaction ID created
  const { data: transactions } = await supabase
    .from('mcredit_transactions')
    .select('id')
    .eq('reference_type', 'stripe_checkout')
    .eq('reference_id', topupRequestId)
    .order('created_at', { ascending: false })
    .limit(1);

  const transactionId = transactions && transactions.length > 0 ? transactions[0].id : null;

  // Update top-up request status
  const serializedPaymentRef = `stripe_session_id: test_sess_123, stripe_payment_intent_id: test_pi_123, usd_amount: ${usdAmount}`;
  const adminNotesStr = `stripe_session_id: test_sess_123, stripe_payment_intent_id: test_pi_123`;

  const { error: updateErr } = await supabase
    .from('mcredit_topup_requests')
    .update({
      status: 'Approved',
      approved_by: testUserId,
      approved_at: new Date().toISOString(),
      payment_reference: serializedPaymentRef,
      transaction_id: transactionId,
      admin_notes: adminNotesStr,
      updated_at: new Date().toISOString()
    })
    .eq('id', topupRequestId);

  if (updateErr) {
    console.error("Webhook test: Failed to update request status.", updateErr.message);
    return;
  }

  // Insert simulated receipt
  const { error: receiptErr } = await supabase.from('mcredit_receipts').insert({
    receipt_number: generateReceiptNumber(),
    owner_type: 'user',
    owner_id: testUserId,
    wallet_id: walletId,
    topup_request_id: topupRequestId,
    transaction_id: transactionId,
    amount: Number(mcreditsAmount),
    payment_method: 'stripe',
    payment_reference: serializedPaymentRef,
    status: 'issued',
    issued_to_name: profiles[0].name,
    issued_to_email: 'test@example.com',
    issued_to_company_name: null,
    issued_at: new Date().toISOString()
  });

  if (receiptErr) {
    console.error("Webhook test: Failed to generate receipt.", receiptErr.message);
  } else {
    console.log("Successfully generated payment receipt.");
  }

  // 4. Verify wallet balance after top-up
  const { data: walletAfter, error: wAfterErr } = await supabase
    .from('mcredit_wallets')
    .select('balance')
    .eq('id', walletId)
    .single();

  const balanceAfter = walletAfter ? Number(walletAfter.balance) : 0;
  console.log(`Wallet Balance After: ${balanceAfter} MC`);

  const diff = balanceAfter - balanceBefore;
  console.log(`Difference: ${diff} MC`);

  if (Math.abs(diff - mcreditsAmount) < 0.001) {
    console.log("SUCCESS: Wallet was auto-credited correctly by the expected amount!");
  } else {
    console.error(`FAIL: Wallet balance difference is ${diff}, expected ${mcreditsAmount}`);
  }
}

run();
