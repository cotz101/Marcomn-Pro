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

async function inspectTable() {
  console.log('Inserting test row into platform_settings...');
  const { data: insertData, error: insertError } = await supabase
    .from('platform_settings')
    .insert({ key: 'test_key_temp', value: 'test_value_temp' })
    .select();
  
  if (insertError) {
    console.error('Insert error (likely due to RLS if not authenticated or table missing):', insertError);
  } else {
    console.log('Insert success!', insertData);
    
    console.log('Cleaning up test row...');
    const { error: deleteError } = await supabase
      .from('platform_settings')
      .delete()
      .eq('key', 'test_key_temp');
    console.log('Cleanup error (if any):', deleteError);
  }
}

inspectTable();
