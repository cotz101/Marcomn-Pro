'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { Anchor, Calendar, User, ThumbsUp, MessageSquare, ShieldAlert } from 'lucide-react';
import CreatePost from './CreatePost';
import LogbookPostCard from './LogbookPostCard';

export default function LogbookFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useProfile();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Centralized URL resolver
  const resolveMediaUrl = useCallback((path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('logbook-media').getPublicUrl(path);
    return data.publicUrl;
  }, [supabase]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: posts, error } = await supabase
        .from('logbook_posts')
        .select(`
          id,
          title,
          content,
          media_url,
          media_type,
          video_url,
          post_type,
          excerpt,
          cover_media_url,
          embedded_media,
          author_id,
          created_at,
          user_id,
          author:profiles!user_id (name, avatar_url, headline),
          likes ( id, user_id ),
          comments ( id, user_id, content, created_at, profiles:profiles!user_id (name, avatar_url) ),
          shared_article_id
        `)
        .order('created_at', { ascending: false })
        .order('created_at', { foreignTable: 'comments', ascending: false });

      if (error) throw error;

      // Extract unique article IDs for in-memory hydration
      const articleIds = (posts || [])
        .map(post => post.article_id || post.shared_article_id)
        .filter(Boolean);

      let articles = [];
      if (articleIds.length > 0) {
        try {
          const { data, error: mblogError } = await supabase
            .from('mblogs')
            .select('*')
            .in('id', articleIds);
          if (!mblogError && data) {
            articles = data;
          } else {
            throw mblogError || new Error('No data');
          }
        } catch (mblogsErr) {
          console.warn('DEBUG: Falling back to mblog_articles query due to:', mblogsErr);
          const { data, error: fallbackError } = await supabase
            .from('mblog_articles')
            .select('*')
            .in('id', articleIds);
          if (!fallbackError && data) {
            articles = data;
          }
        }
      }

      // Map to normalize article_id parameter and perform direct clean merge
      const hydratedPosts = posts.map(post => {
        post.article_id = post.article_id || post.shared_article_id;
        const matchedArticle = post.article_id ? articles.find(a => a.id === post.article_id) : null;
        
        let mblogs = null;
        if (matchedArticle) {
          mblogs = {
            ...matchedArticle,
            cover_image: matchedArticle.cover_image || matchedArticle.media_url || null,
            content: matchedArticle.content || matchedArticle.content_html || '',
            title: matchedArticle.title || 'Shared Post'
          };
        }

        return {
          ...post,
          mblogs: post.article_id ? mblogs : null
        };
      });

      setPosts(hydratedPosts);
    } catch (err) {
      console.error('Error fetching logbook posts:', { 
        message: err?.message || err, 
        details: err?.details || null, 
        hint: err?.hint || null 
      });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPosts();

    // Set up real-time postgres changes listener
    const channel = supabase
      .channel('public:logbook_posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logbook_posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchPosts]);

  // ── Feed Auto-Focus: Scroll to a specific post when ?focus= is present ──
  useEffect(() => {
    if (loading || posts.length === 0) return;

    const focusPostId = searchParams.get('focus');
    if (!focusPostId) return;

    // Small delay to ensure DOM is fully painted
    const timer = setTimeout(() => {
      const targetEl = document.getElementById(`post-${focusPostId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Apply a navy pulse highlight
        targetEl.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
        targetEl.style.boxShadow = '0 0 0 3px rgba(14, 42, 77, 0.35), 0 0 20px rgba(14, 42, 77, 0.15)';
        targetEl.style.borderColor = '#0e2a4d';

        // Fade out the highlight after 2.5s
        setTimeout(() => {
          targetEl.style.boxShadow = '';
          targetEl.style.borderColor = '';
        }, 2500);
      }

      // Clean the URL query param so refreshes don't re-trigger
      router.replace('/logbook', { scroll: false });
    }, 400);

    return () => clearTimeout(timer);
  }, [loading, posts, searchParams, router]);

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts((prev) => prev.map((post) => {
      if (post.id === updatedPost.id) {
        return {
          ...updatedPost,
          mblogs: post.mblogs // Keep the hydrated blog data to prevent UI layout collapse
        };
      }
      return post;
    }));
  };

  const PostSkeleton = () => (
    <div className="card p-6 animate-pulse border border-gray-100 bg-white rounded-xl mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/4" />
        </div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
      <div className="h-3 bg-gray-100 rounded w-5/6 mb-4" />
      <div className="h-48 bg-gray-50 rounded-xl w-full" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 max-sm:max-w-full max-sm:px-0">
      <CreatePost onPostCreated={handlePostCreated} />

      {loading ? (
        <div className="space-y-6">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-xl shadow-sm mt-6">
          <div className="flex justify-center mb-4">
            <Anchor size={48} className="text-gray-300 animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-[#0e2a4d]">No Log Entries Yet</h3>
          <p className="text-gray-500 mt-2 max-w-xs mx-auto text-sm">
            Be the first to log a new update or share media from your current voyage.
          </p>
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          {posts.map((post) => (
            <LogbookPostCard
              key={post.id}
              post={post}
              userId={userId}
              onPostDeleted={handlePostDeleted}
              onPostUpdated={handlePostUpdated}
              resolveMediaUrl={resolveMediaUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
