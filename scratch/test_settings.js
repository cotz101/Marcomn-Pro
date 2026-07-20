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

async function run() {
  console.log("Fetching platform settings...");
  
  const { data: packages, error: pkgErr } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('key', 'mcredit_topup_packages')
    .maybeSingle();

  const { data: rate, error: rateErr } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('key', 'mcredits_per_usd')
    .maybeSingle();

  console.log("Packages:", packages ? packages.value : null, pkgErr);
  console.log("Exchange Rate (mcredits_per_usd):", rate ? rate.value : null, rateErr);
}

run();
