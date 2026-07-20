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

async function findUser() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, global_role')
    .limit(5);

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("Profiles found:");
  profiles.forEach(p => {
    console.log(`- ID: ${p.id}, Name: ${p.name}, Role: ${p.global_role}`);
  });
}

findUser();
