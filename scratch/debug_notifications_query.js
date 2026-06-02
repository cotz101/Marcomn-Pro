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
    env[key] = value.replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testQuery() {
  const targetId = '5c23c747-d899-47bb-b157-a9477365accc'; // Use any valid uuid
  console.log('Testing query on recipient_id:', targetId);
  
  const { data, error } = await supabase
    .from('notifications')
    .select('*, sender:profiles!sender_id(id, name, avatar_url, headline)')
    .eq('recipient_id', targetId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('--- SUPABASE QUERY ERROR ---');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Details:', error.details);
    console.error('Hint:', error.hint);
    console.error('Full Error Object:', JSON.stringify(error, null, 2));
  } else {
    console.log('Query Succeeded! Rows fetched:', data.length);
  }
}

testQuery();
