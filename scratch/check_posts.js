
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPosts() {
  const { data, error } = await supabase.from('posts').select('*').limit(5);
  if (error) {
    console.error('Error fetching posts:', error);
  } else {
    console.log('Posts count:', data.length);
    data.forEach(p => console.log(`Post ID: ${p.id}, Content Length: ${p.content?.length}`));
  }
}

checkPosts();
