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

async function comparePosts() {
  // Let's query all posts containing youtube links in content or having video_url
  const { data: posts, error } = await supabase
    .from('logbook_posts')
    .select('*, author:profiles!user_id (*)');

  if (error) {
    console.error('Error fetching posts:', error);
    return;
  }

  // Filter for posts with YouTube links in content or video_url
  const youtubePosts = posts.filter(p => {
    const hasLink = p.content && (p.content.includes('youtube.com') || p.content.includes('youtu.be'));
    const hasVideoUrl = !!p.video_url;
    return hasLink || hasVideoUrl;
  });

  console.log(`Found ${youtubePosts.length} YouTube posts.\n`);

  youtubePosts.forEach((post, i) => {
    console.log(`--- YouTube Post #${i + 1} ---`);
    console.log('ID:', post.id);
    console.log('User ID (user_id):', post.user_id);
    console.log('Author ID (author_id):', post.author_id);
    console.log('Author Object:', post.author);
    console.log('Content:', post.content);
    console.log('Post Type:', post.post_type);
    console.log('Media URL:', post.media_url);
    console.log('Media Type:', post.media_type);
    console.log('Shared Article ID:', post.shared_article_id);
    console.log('Created At:', post.created_at);
    console.log('Video URL:', post.video_url);
    console.log('Cover Media URL:', post.cover_media_url);
    console.log('Embedded Media:', post.embedded_media);
    console.log('-----------------------------\n');
  });
}

comparePosts();
