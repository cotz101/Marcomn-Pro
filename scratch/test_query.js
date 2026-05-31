import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env.local parser
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFullQuery() {
  console.log('Testing unified sidebar stats query...');
  const { data, error } = await supabase
    .from('mblog_articles')
    .select(`
      id,
      title,
      author:profiles(name),
      likes:mblog_article_likes(id),
      comments:mblog_article_comments(id),
      shares:logbook_posts!shared_article_id(id)
    `);

  if (error) {
    console.error('Unified stats query error:', error);
  } else {
    console.log(`Success! Fetched ${data.length} articles with relations.`);
    data.forEach(a => {
      console.log(`Article "${a.title}":`);
      console.log(`  Likes count: ${a.likes?.length || 0}`);
      console.log(`  Comments count: ${a.comments?.length || 0}`);
      console.log(`  Shares count: ${a.shares?.length || 0}`);
    });
  }
}

testFullQuery();
