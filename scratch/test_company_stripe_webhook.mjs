import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import fs from 'fs';
import crypto from 'crypto';

// 1. Parse .env.local
const env = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
env.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];
const webhookSecret = envVars['STRIPE_WEBHOOK_SECRET'];
const stripeSecretKey = envVars['STRIPE_SECRET_KEY'];

console.log('Supabase URL:', supabaseUrl);
console.log('Stripe Webhook Secret:', webhookSecret ? 'Configured (Hidden)' : 'Missing');

const supabase = createClient(supabaseUrl, serviceRoleKey);
const stripe = new Stripe(stripeSecretKey);

const COMPANY_ID = '5454e7da-7b84-4ed7-a8cc-1855c3af040b'; // Asian Marine Consultants Pte Ltd
const USER_ID = '50c6bed6-ad08-454d-bf63-aa3278d57cf9';

async function getWalletBalance(ownerType, ownerId) {
  const { data, error } = await supabase
    .from('mcredit_wallets')
    .select('balance')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data) return 0;
  return Number(data.balance);
}

async function validatePackage(usdAmount) {
  console.log(`\n======================================`);
  console.log(`TESTING COMPANY PACKAGE: USD ${usdAmount}`);
  console.log(`======================================`);

  // Get balances before
  const companyBalanceBefore = await getWalletBalance('company', COMPANY_ID);
  const userBalanceBefore = await getWalletBalance('user', USER_ID);
  console.log(`Company balance BEFORE: ${companyBalanceBefore} MC`);
  console.log(`User balance BEFORE: ${userBalanceBefore} MC`);

  // 1. Create pending top-up request
  const { data: request, error: reqError } = await supabase
    .from('mcredit_topup_requests')
    .insert({
      requester_id: USER_ID,
      owner_type: 'company',
      owner_id: COMPANY_ID,
      amount: Number(usdAmount), // Assuming 1:1 exchange rate
      status: 'Pending',
      payment_method: 'stripe',
      remarks: `Stripe Checkout: USD ${usdAmount} package`
    })
    .select()
    .single();

  if (reqError || !request) {
    throw new Error(`Failed to create pending request: ${JSON.stringify(reqError)}`);
  }
  console.log(`Created Pending top-up request: ${request.id}`);

  // 2. Construct mock Stripe session completed event
  const sessionId = `cs_test_comp_${Math.random().toString(36).substring(2, 12)}`;
  const paymentIntentId = `pi_test_comp_${Math.random().toString(36).substring(2, 12)}`;

  const mockSession = {
    id: sessionId,
    object: 'checkout.session',
    payment_intent: paymentIntentId,
    payment_status: 'paid',
    status: 'complete',
    metadata: {
      topupRequestId: request.id,
      ownerType: 'company',
      ownerId: COMPANY_ID,
      requesterId: USER_ID,
      usdAmount: usdAmount.toString(),
      mcreditsAmount: usdAmount.toString(),
      exchangeRate: '1.0',
      environment: 'development'
    }
  };

  const mockEvent = {
    id: `evt_test_comp_${Math.random().toString(36).substring(2, 12)}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: mockSession
    },
    type: 'checkout.session.completed'
  };

  const payload = JSON.stringify(mockEvent);
  const timestamp = Math.floor(Date.now() / 1000);
  const signaturePayload = `${timestamp}.${payload}`;
  const hmacSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signaturePayload)
    .digest('hex');
  const signature = `t=${timestamp},v1=${hmacSignature}`;

  // 3. Trigger webhook endpoint
  const response = await fetch('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature
    },
    body: payload
  });

  const bodyText = await response.text();
  console.log('Webhook response status:', response.status);
  console.log('Webhook response body:', bodyText);

  if (response.status !== 200) {
    throw new Error(`Webhook request failed with status ${response.status}`);
  }

  // Get balances after
  const companyBalanceAfter = await getWalletBalance('company', COMPANY_ID);
  const userBalanceAfter = await getWalletBalance('user', USER_ID);
  console.log(`Company balance AFTER: ${companyBalanceAfter} MC`);
  console.log(`User balance AFTER: ${userBalanceAfter} MC`);

  // Verify business rules
  const companyBalanceDiff = companyBalanceAfter - companyBalanceBefore;
  const userBalanceDiff = userBalanceAfter - userBalanceBefore;

  console.log(`Verification:`);
  console.log(`- Company credited by: ${companyBalanceDiff} MC (Expected: ${usdAmount} MC)`);
  console.log(`- Personal wallet credited by: ${userBalanceDiff} MC (Expected: 0 MC)`);

  const companyPassed = companyBalanceDiff === Number(usdAmount);
  const userPassed = userBalanceDiff === 0;

  // 4. Verify Receipt
  const { data: receipt } = await supabase
    .from('mcredit_receipts')
    .select('*')
    .eq('topup_request_id', request.id)
    .maybeSingle();

  const receiptPassed = receipt ? true : false;
  console.log(`- Receipt generated: ${receiptPassed ? 'YES (' + receipt.receipt_number + ')' : 'NO'}`);
  if (receipt) {
    console.log(`  - Receipt Reference: ${receipt.payment_reference}`);
    console.log(`  - Issued to company name: ${receipt.issued_to_company_name}`);
  }

  // 5. Verify Notification
  // Fetch recent notification for requester
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', USER_ID)
    .order('created_at', { ascending: false })
    .limit(1);

  const notifPassed = notifications && notifications.length > 0 && notifications[0].title === 'Top-Up Success';
  console.log(`- Requester Notification generated: ${notifPassed ? 'YES ("' + notifications[0].body + '")' : 'NO'}`);

  const testPassed = companyPassed && userPassed && receiptPassed;
  console.log(`RESULT FOR PACKAGE USD ${usdAmount}: ${testPassed ? 'PASS' : 'FAIL'}`);

  return {
    package: `USD ${usdAmount}`,
    before: companyBalanceBefore,
    after: companyBalanceAfter,
    receiptGenerated: receiptPassed ? 'Yes' : 'No',
    notificationGenerated: notifPassed ? 'Yes' : 'No',
    passed: testPassed
  };
}

async function runAll() {
  try {
    const results = [];
    results.push(await validatePackage(10));
    results.push(await validatePackage(25));
    results.push(await validatePackage(50));

    console.log('\n======================================');
    console.log('SUMMARY OF COMPANY WALLET VALIDATION');
    console.log('======================================');
    console.table(results);

    const overallPassed = results.every(r => r.passed);
    console.log(`OVERALL RESULT: ${overallPassed ? 'PASS' : 'FAIL'}`);
  } catch (err) {
    console.error('Validation script failed:', err.message);
  }
}

runAll();
