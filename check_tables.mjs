import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking candidate_reputation_summary...");
  const { data: repData, error: repError } = await supabase.from('candidate_reputation_summary').select('*').limit(1);
  console.log("repError:", repError?.message || repError);

  console.log("Checking job_feedback...");
  const { data: feedData, error: feedError } = await supabase.from('job_feedback').select('*').limit(1);
  console.log("feedError:", feedError?.message || feedError);
}
check();
