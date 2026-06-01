import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value.replace(/^['"]|['"]$/g, ''); // strip optional quotes
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSession() {
  console.log('Querying all profiles to see their global_role...');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, global_role');
  
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('All profiles:', profiles);
  }
}

checkSession();
