import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lduqamdkbishehfxsafj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkdXFhbWRrYmlzaGVoZnhzYWZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcyOTU4NywiZXhwIjoyMDkzMzA1NTg3fQ.29KsgQzVgYNHHwtWZCquEIBtWhvRdGCMXNHOZgO_p98'
);

async function inspect() {
  const { data: appData, error } = await supabase
    .from('applications')
    .select('job_id, applicant_id, job:jobs(poster_id, company_id)')
    .eq('id', 'd38d6a96-7c05-4c59-ab5c-f2a8259e2311')
    .maybeSingle();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('AppData Row:', JSON.stringify(appData, null, 2));
  }
}

inspect();
