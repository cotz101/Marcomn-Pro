const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);
const userId = '152062d7-ae95-4952-9173-5c203a7fd37e'; // Test User

async function checkState() {
  // 1. Fetch wallet
  const { data: wallet } = await supabase
    .from('mcredit_wallets')
    .select('*')
    .eq('owner_id', userId)
    .single();

  console.log("Wallet info:", wallet);

  // 2. Fetch top-up requests
  const { data: topups } = await supabase
    .from('mcredit_topup_requests')
    .select('*')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });

  console.log("\nTop-ups found:", topups.length);
  topups.forEach(t => {
    console.log(`- ID: ${t.id}, Amount: ${t.amount}, Status: ${t.status}, Ref: ${t.payment_reference}`);
  });

  // 3. Fetch refund requests
  const { data: refunds } = await supabase
    .from('mcredit_refund_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  console.log("\nRefund requests found:", refunds.length);
  refunds.forEach(r => {
    console.log(`- ID: ${r.id}, TopupID: ${r.topup_request_id}, Requested: ${r.requested_mcredits}, Approved: ${r.approved_mcredits}, Status: ${r.status}`);
  });
}

checkState();
