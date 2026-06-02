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

async function checkLogbook() {
  const { data, error } = await supabase
    .from('logbook_posts')
    .select('id, user_id, author_id, author:profiles!user_id (id, name, avatar_url, headline)');

  if (error) {
    console.error('Error fetching logbook_posts:', error);
    return;
  }
  
  console.log('Total posts:', data.length);
  const nullAuthors = data.filter(p => !p.author);
  console.log('Posts with null author object:', nullAuthors.length);
  if (nullAuthors.length > 0) {
    console.log('Sample posts with null author:', nullAuthors.slice(0, 3));
    // Let's check if the user_ids of those null authors exist in profiles at all
    const userIds = nullAuthors.map(p => p.user_id);
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', userIds);
    console.log('Profiles found for these user_ids:', profs);
  }
}

checkLogbook();
