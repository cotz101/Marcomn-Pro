const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const fs = require('fs');

// 1. Read env variables
const env = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';
let stripeSecretKey = '';
let enableStripeRefunds = '';

env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length < 2) return;
  const key = parts[0].trim();
  const val = parts.slice(1).join('=').trim();
  if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
  if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = val;
  if (key === 'STRIPE_SECRET_KEY') stripeSecretKey = val;
  if (key === 'ENABLE_MCREDIT_STRIPE_REFUNDS') enableStripeRefunds = val;
});

console.log("Stripe Secret Key loaded:", stripeSecretKey ? stripeSecretKey.substring(0, 12) + "..." : "NONE");
console.log("Supabase URL loaded:", supabaseUrl);
console.log("ENABLE_MCREDIT_STRIPE_REFUNDS:", enableStripeRefunds);

if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_test_')) {
  console.error("FATAL: Stripe key must be sk_test_...");
  process.exit(1);
}

if (enableStripeRefunds !== 'true') {
  console.error("FATAL: ENABLE_MCREDIT_STRIPE_REFUNDS must be set to true in .env.local for this test.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const stripe = new Stripe(stripeSecretKey);
const userId = '152062d7-ae95-4952-9173-5c203a7fd37e'; // Test User

async function runTest() {
  try {
    console.log("\n=================== STRIPE SANDBOX REFUND TEST ===================");

    // 1. Get/Create wallet
    console.log("1. Resolving wallet for user...");
    const { data: walletId, error: walletErr } = await supabase.rpc('get_or_create_wallet', {
      p_owner_type: 'user',
      p_owner_id: userId
    });
    if (walletErr || !walletId) throw new Error("Failed to get/create wallet: " + JSON.stringify(walletErr));
    console.log("Resolved Wallet ID:", walletId);

    // Get original wallet balance
    const { data: walletOrig, error: walletOrigErr } = await supabase
      .from('mcredit_wallets')
      .select('*')
      .eq('id', walletId)
      .single();
    if (walletOrigErr || !walletOrig) throw new Error("Failed to fetch wallet info");
    const originalBalance = Number(walletOrig.balance);
    console.log("Original Wallet Balance:", originalBalance.toFixed(2), "MC");

    // 2. Create Stripe PaymentIntent in sandbox
    console.log("\n2. Creating Stripe PaymentIntent ($10.00 USD) in sandbox...");
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10 USD in cents
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      }
    });
    console.log("Stripe PaymentIntent Created & Succeeded. ID:", paymentIntent.id);
    console.log("PaymentIntent Status:", paymentIntent.status);

    // 3. Insert Top-up Request
    console.log("\n3. Inserting Top-up Request record in DB...");
    const { data: topupRequest, error: topupInsertErr } = await supabase
      .from('mcredit_topup_requests')
      .insert({
        requester_id: userId,
        owner_type: 'user',
        owner_id: userId,
        amount: 10.00,
        status: 'Pending',
        payment_method: 'stripe',
        payment_reference: paymentIntent.id
      })
      .select()
      .single();


    if (topupInsertErr || !topupRequest) throw topupInsertErr;
    console.log("Inserted Top-up Request ID:", topupRequest.id);

    // 4. Credit user's wallet (Simulating stripe checkout.session.completed webhook processing)
    console.log("\n4. Crediting user's wallet with 10.00 MC...");
    const { data: balanceAfterCredit, error: creditErr } = await supabase.rpc('adjust_wallet_balance', {
      p_wallet_id: walletId,
      p_amount: 10.00,
      p_direction: 'credit',
      p_transaction_type: 'purchase_completed',
      p_justification_note: `Stripe Top-Up - USD 10.00`,
      p_created_by: userId,
      p_reference_type: 'stripe_checkout',
      p_reference_id: topupRequest.id,
      p_override_insufficient: true
    });
    if (creditErr) throw creditErr;

    // Fetch new transaction ID
    const { data: txs } = await supabase
      .from('mcredit_transactions')
      .select('id')
      .eq('reference_type', 'stripe_checkout')
      .eq('reference_id', topupRequest.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const transactionId = txs && txs.length > 0 ? txs[0].id : null;

    // Approve the request
    const serializedPaymentRef = `stripe_session_id: cs_dummy_session_id, stripe_payment_intent_id: ${paymentIntent.id}, usd_amount: 10.00`;
    const { error: topupUpdateErr } = await supabase
      .from('mcredit_topup_requests')
      .update({
        status: 'Approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        payment_reference: serializedPaymentRef,
        transaction_id: transactionId,
        admin_notes: `stripe_session_id: cs_dummy_session_id, stripe_payment_intent_id: ${paymentIntent.id}`
      })
      .eq('id', topupRequest.id);
    if (topupUpdateErr) throw topupUpdateErr;

    // Verify wallet balance after top-up
    const { data: walletAfterTopup } = await supabase
      .from('mcredit_wallets')
      .select('balance')
      .eq('id', walletId)
      .single();
    const balancePostTopup = Number(walletAfterTopup.balance);
    console.log("Wallet Balance After Top-Up:", balancePostTopup.toFixed(2), "MC (Expected:", (originalBalance + 10).toFixed(2), "MC)");

    // 5. Submit a partial refund request of 3.00 MC
    console.log("\n5. Submitting a partial refund request of 3.00 MC...");
    const { data: refundRequest, error: refundRequestErr } = await supabase
      .from('mcredit_refund_requests')
      .insert({
        user_id: userId,
        wallet_id: walletId,
        topup_request_id: topupRequest.id,
        stripe_payment_intent_id: paymentIntent.id,
        requested_mcredits: 3.00,
        max_refundable_mcredits_snapshot: 10.00,
        reason: 'unused_credits',
        user_note: 'Stripe sandbox partial refund test',
        status: 'pending_review'
      })
      .select()
      .single();
    if (refundRequestErr || !refundRequest) throw refundRequestErr;
    console.log("Inserted Refund Request ID:", refundRequest.id);

    // Confirm balance before approval has not changed
    const { data: walletBeforeApproval } = await supabase
      .from('mcredit_wallets')
      .select('balance')
      .eq('id', walletId)
      .single();
    console.log("Wallet Balance Before Approval (Still Pending):", Number(walletBeforeApproval.balance).toFixed(2), "MC (Expected:", balancePostTopup.toFixed(2), "MC)");

    // 6. Approve the partial refund (Simulating admin approval server action)
    console.log("\n6. Simulating Admin Approval: Debiting 3.00 MC and calling Stripe refunds API...");
    
    // Deduct 3.00 MC from wallet
    const { data: balanceAfterDebit, error: debitErr } = await supabase.rpc('adjust_wallet_balance', {
      p_wallet_id: walletId,
      p_amount: 3.00,
      p_direction: 'debit',
      p_transaction_type: 'refund',
      p_justification_note: `MCredits Refund Approved - Request: ${refundRequest.id}`,
      p_created_by: userId,
      p_reference_type: 'mcredit_refund_request',
      p_reference_id: refundRequest.id,
      p_override_insufficient: false
    });
    if (debitErr) throw debitErr;

    // Get the debit transaction ID
    const { data: debitTxs } = await supabase
      .from('mcredit_transactions')
      .select('id')
      .eq('reference_type', 'mcredit_refund_request')
      .eq('reference_id', refundRequest.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const debitTxId = debitTxs && debitTxs.length > 0 ? debitTxs[0].id : null;

    // Call Stripe Refund API
    console.log("Triggering Stripe Refund API in sandbox...");
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      amount: 300 // 3.00 MC = 300 cents USD
    });
    console.log("Stripe Refund Succeeded. ID:", refund.id);
    console.log("Stripe Refund Status:", refund.status);

    // Update refund request status in DB
    const { error: refundUpdateErr } = await supabase
      .from('mcredit_refund_requests')
      .update({
        status: 'refunded',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approved_mcredits: 3.00,
        original_transaction_id: debitTxId,
        stripe_refund_id: refund.id,
        admin_note: 'Approved sandbox partial refund test'
      })
      .eq('id', refundRequest.id);
    if (refundUpdateErr) throw refundUpdateErr;

    // Verify wallet balance after refund
    const { data: walletAfterRefund } = await supabase
      .from('mcredit_wallets')
      .select('balance')
      .eq('id', walletId)
      .single();
    const finalBalance = Number(walletAfterRefund.balance);
    console.log("Wallet Balance After Refund Approval:", finalBalance.toFixed(2), "MC (Expected:", (balancePostTopup - 3).toFixed(2), "MC)");

    console.log("\n=================== TEST RESULT SUMMARY ===================");
    console.log(`Original wallet balance: ${originalBalance.toFixed(2)} MC`);
    console.log(`Wallet balance after top-up: ${balancePostTopup.toFixed(2)} MC`);
    console.log(`Wallet balance after refund: ${finalBalance.toFixed(2)} MC`);
    console.log(`PaymentIntent ID: ${paymentIntent.id}`);
    console.log(`Stripe Refund ID: ${refund.id}`);
    console.log(`Refund request final status: refunded`);
    console.log("===========================================================");

  } catch (err) {
    console.error("\nTEST FAILED WITH ERROR:", err);
  }
}

runTest();
