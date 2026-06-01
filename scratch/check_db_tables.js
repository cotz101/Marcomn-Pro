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

async function checkTables() {
  console.log('Querying platform_settings...');
  const { data: settingsData, error: settingsError } = await supabase
    .from('platform_settings')
    .select('*');
  
  if (settingsError) {
    console.error('platform_settings query error:', settingsError);
  } else {
    console.log('platform_settings schema/data:', settingsData);
  }

  console.log('Querying current profile details...');
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (profileError) {
    console.error('profiles query error:', profileError);
  } else {
    console.log('Profiles table columns:', Object.keys(profileData[0] || {}));
    console.log('Profile first row sample:', profileData[0]);
  }
}

checkTables();
