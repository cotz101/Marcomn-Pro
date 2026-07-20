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

async function testFetch() {
  console.log("Fetching mcredit_refund_requests...");
  const { data: requests, error } = await supabase
    .from('mcredit_refund_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching refund requests:", error);
    return;
  }

  console.log(`Successfully fetched ${requests.length} refund requests.`);
  if (requests.length > 0) {
    console.log("Sample request:", requests[0]);

    // Test profiles fetch
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
    console.log("Unique user IDs:", userIds);
    if (userIds.length > 0) {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);
      if (pError) console.error("Error fetching profiles:", pError);
      else console.log(`Fetched ${profiles.length} profiles.`);
    }

    // Test companies fetch
    const companyIds = [...new Set(requests.map(r => r.company_id).filter(Boolean))];
    console.log("Unique company IDs:", companyIds);
    if (companyIds.length > 0) {
      const { data: companies, error: cError } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .in('id', companyIds);
      if (cError) console.error("Error fetching companies:", cError);
      else console.log(`Fetched ${companies.length} companies.`);
    }

    // Test top-up requests fetch
    const topupIds = [...new Set(requests.map(r => r.topup_request_id).filter(Boolean))];
    console.log("Unique top-up request IDs:", topupIds);
    if (topupIds.length > 0) {
      const { data: topups, error: tError } = await supabase
        .from('mcredit_topup_requests')
        .select('id, amount, payment_reference, admin_notes')
        .in('id', topupIds);
      if (tError) console.error("Error fetching topups:", tError);
      else console.log(`Fetched ${topups.length} topups.`);
    }
  }
}

testFetch();
