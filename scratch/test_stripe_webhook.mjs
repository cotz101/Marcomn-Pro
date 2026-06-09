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
const webhookSecret = envVars['STRIPE_WEBHOOK_SECRET'] || 'whsec_placeholder';
const stripeSecretKey = envVars['STRIPE_SECRET_KEY'] || 'sk_test_placeholder';

console.log('Supabase URL:', supabaseUrl);
console.log('Stripe Webhook Secret:', webhookSecret);

const supabase = createClient(supabaseUrl, serviceRoleKey);
const stripe = new Stripe(stripeSecretKey);

async function testWebhook() {
  try {
    // 2. Fetch a test user from profiles
    const { data: users, error: userError } = await supabase.from('profiles').select('id, name').limit(1);
    if (userError || !users || users.length === 0) {
      throw new Error('No test user profile found in database: ' + JSON.stringify(userError));
    }
    const testUser = users[0];
    console.log(`Using test user: ${testUser.name} (${testUser.id})`);

    // 3. Create a pending top-up request
    const { data: request, error: reqError } = await supabase
      .from('mcredit_topup_requests')
      .insert({
        requester_id: testUser.id,
        owner_type: 'user',
        owner_id: testUser.id,
        amount: 100.0,
        status: 'Pending',
        payment_method: 'stripe',
        remarks: 'Stripe Checkout: USD 100 package'
      })
      .select()
      .single();

    if (reqError || !request) {
      throw new Error('Failed to create pending top-up request: ' + JSON.stringify(reqError));
    }
    console.log(`Created pending top-up request: ${request.id}`);

    // 4. Construct mock checkout.session.completed Stripe event
    const sessionId = `cs_test_${Math.random().toString(36).substring(2, 12)}`;
    const paymentIntentId = `pi_test_${Math.random().toString(36).substring(2, 12)}`;
    
    const mockSession = {
      id: sessionId,
      object: 'checkout.session',
      payment_intent: paymentIntentId,
      payment_status: 'paid',
      status: 'complete',
      metadata: {
        topupRequestId: request.id,
        ownerType: 'user',
        ownerId: testUser.id,
        requesterId: testUser.id,
        usdAmount: '100',
        mcreditsAmount: '100',
        exchangeRate: '1.0',
        environment: 'development'
      }
    };

    const mockEvent = {
      id: `evt_test_${Math.random().toString(36).substring(2, 12)}`,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: mockSession
      },
      type: 'checkout.session.completed'
    };

    const payload = JSON.stringify(mockEvent);

    // 5. Generate signature header manually using Node.js crypto
    const timestamp = Math.floor(Date.now() / 1000);
    const signaturePayload = `${timestamp}.${payload}`;
    const hmacSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signaturePayload)
      .digest('hex');
    const signature = `t=${timestamp},v1=${hmacSignature}`;

    console.log('\n--- Trigerring Webhook First Time (Crediting Wallet) ---');
    const response1 = await fetch('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature
      },
      body: payload
    });

    const body1 = await response1.text();
    console.log('Response Status:', response1.status);
    console.log('Response Body:', body1);

    if (response1.status !== 200) {
      throw new Error('First webhook execution failed');
    }

    console.log('\n--- Triggering Webhook Second Time (Idempotency Check) ---');
    const response2 = await fetch('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature
      },
      body: payload
    });

    const body2 = await response2.text();
    console.log('Response Status:', response2.status);
    console.log('Response Body:', body2);

    if (response2.status !== 200) {
      throw new Error('Second webhook execution failed');
    }

    const responseJson = JSON.parse(body2);
    if (!responseJson.received || responseJson.message !== 'Request already processed') {
      throw new Error('Idempotency check failed: unexpected response payload: ' + body2);
    }
    console.log('Success! Idempotency check verified: repeat event ignored.');

    // 6. Verify database records
    console.log('\n--- Verifying Database Records ---');
    
    const { data: updatedRequest } = await supabase
      .from('mcredit_topup_requests')
      .select('*')
      .eq('id', request.id)
      .single();
    
    console.log('Updated Top-Up Request Status:', updatedRequest.status);
    console.log('Payment Reference:', updatedRequest.payment_reference);
    console.log('Admin Notes:', updatedRequest.admin_notes);

    const { data: receipt } = await supabase
      .from('mcredit_receipts')
      .select('*')
      .eq('topup_request_id', request.id)
      .maybeSingle();

    if (receipt) {
      console.log('Receipt successfully created!');
      console.log('- Receipt No:', receipt.receipt_number);
      console.log('- Amount:', receipt.amount, 'MC');
      console.log('- Reference:', receipt.payment_reference);
      console.log('- Issued To:', receipt.issued_to_name, `<${receipt.issued_to_email}>`);
    } else {
      console.log('WARNING: Receipt was not found in the database!');
    }

    const { data: transactions } = await supabase
      .from('mcredit_transactions')
      .select('*')
      .eq('reference_id', request.id);

    console.log(`Found ${transactions?.length || 0} ledger transactions matching top-up request UUID.`);
    if (transactions && transactions.length > 0) {
      transactions.forEach(t => {
        console.log(`- Transaction ID: ${t.id}, Type: ${t.transaction_type}, Justification: ${t.justification_note}, Amount: ${t.amount} (${t.direction})`);
      });
    }

  } catch (err) {
    console.error('Test Execution Failed:', err.message);
  }
}

testWebhook();
