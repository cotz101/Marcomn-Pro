'use client';

import { useState, useEffect, useCallback } from 'react';
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
      const { data, error } = await supabase
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
          comments ( id, user_id, content, created_at, profiles:profiles!user_id (name, avatar_url) )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Error fetching logbook posts:', err);
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

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? updatedPost : post)));
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
    <div className="max-w-3xl mx-auto px-4 py-6">
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
