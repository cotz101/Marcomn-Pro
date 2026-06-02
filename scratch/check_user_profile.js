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

async function checkSpecificUser() {
  const targetId = '5c23c747-d899-47bb-b157-a9477365accc';
  
  // 1. Fetch profile details
  console.log('Querying profile with id:', targetId);
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetId)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
  } else {
    console.log('Profile details:', profile);
  }

  // 2. Fetch logbook posts matching targetId and see join behavior
  console.log('Querying logbook posts for user_id:', targetId);
  const { data: posts, error: postsError } = await supabase
    .from('logbook_posts')
    .select('id, user_id, author_id, author:profiles!user_id (id, name, avatar_url, headline)')
    .eq('user_id', targetId);

  if (postsError) {
    console.error('Error fetching posts:', postsError);
  } else {
    console.log(`Found ${posts.length} posts.`, posts);
  }
}

checkSpecificUser();
