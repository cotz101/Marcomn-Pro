'use client';

/**
 * @deprecated
 * This file is deprecated/orphaned.
 * The production path now uses the unified, Teams-style chat architecture in GroupPage.jsx.
 * Kept temporarily for rollback safety.
 */

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import GroupPostInput from './GroupPostInput';
import DiscussionPost from './DiscussionPost';

export default function GroupPostFeed({ groupId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userId, profile } = useProfile();
  const supabase = createClient();

  useEffect(() => {
    fetchPosts();
  }, [groupId]);

  const fetchPosts = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      // 1. Fetch posts from group_posts
      const { data: postsData, error: postsError } = await supabase
        .from('group_posts')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      // 2. Fetch unique profiles for these posts (Batch Fetch strategy)
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, headline')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // 3. Map profiles to posts
      const profileMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});

      const mergedPosts = postsData.map(post => {
        const postProfile = profileMap[post.user_id];
        return {
          ...post,
          author: postProfile?.name || 'Anonymous User',
          avatar: postProfile?.avatar_url,
          headline: postProfile?.headline || 'Maritime Member',
          // Adapt for DiscussionPost component expectations
          role: postProfile?.headline || 'Member',
          timestamp: new Date(post.created_at).toLocaleDateString(),
          text: post.content,
          // We'll need to fetch comments separately or use a separate component
          comments: [] 
        };
      });

      setPosts(mergedPosts);
    } catch (err) {
      console.error('Error fetching group posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = (newPost) => {
    // Instant Local State Update: Prepend the new post to the local state
    setPosts(prevPosts => [newPost, ...prevPosts]);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Integrated Post Input - Clean Slate Rebuild */}
      <GroupPostInput onPostCreated={handlePostCreated} />

      {/* Posts List */}
      <div className="space-y-4 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm italic">Sighting posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
            <p className="text-slate-400 text-sm italic">No discussions yet. Start the conversation!</p>
          </div>
        ) : (
          posts.map((post) => (
            <DiscussionPost key={post.id} post={post} groupId={groupId} />
          ))
        )}
      </div>
    </div>
  );
}
