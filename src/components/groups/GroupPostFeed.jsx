'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { Send, User } from 'lucide-react';

export default function GroupPostFeed({ groupId }) {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const { userId } = useProfile();
  const supabase = createClient();

  useEffect(() => {
    fetchPosts();
  }, [groupId]);

  const fetchPosts = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      // 1. Fetch posts
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

      // 2. Fetch unique profiles for these posts
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // 3. Map profiles to posts
      const profileMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});

      const mergedPosts = postsData.map(post => ({
        ...post,
        profiles: profileMap[post.user_id] || null
      }));

      setPosts(mergedPosts);
    } catch (err) {
      console.error('Error fetching group posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !userId) return;

    try {
      const { data: postData, error: postError } = await supabase
        .from('group_posts')
        .insert({
          group_id: groupId,
          user_id: userId,
          content: newPostContent.trim()
        })
        .select('*')
        .single();

      if (postError) throw postError;

      // Fetch the author's profile for the new post
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', userId)
        .single();

      const fullPost = {
        ...postData,
        profiles: profileData
      };

      // Optimistic update
      setPosts([fullPost, ...posts]);
      setNewPostContent('');
    } catch (err) {
      console.error('Error creating post:', err);
      alert('Failed to create post. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Post Composer */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <textarea
          className="w-full min-h-[100px] p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
          placeholder="Share something with the group..."
          value={newPostContent}
          onChange={(e) => setNewPostContent(e.target.value)}
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleCreatePost}
            disabled={!newPostContent.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-[#002b4e] text-white text-sm font-semibold rounded-lg hover:bg-[#003d70] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Send size={16} />
            <span>Post</span>
          </button>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-slate-400 text-sm italic">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm italic">No posts yet. Be the first to share!</div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                  {post.profiles?.avatar_url ? (
                    <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} className="text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    {post.profiles?.name || 'Anonymous User'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">
                    {new Date(post.created_at).toLocaleDateString()} · {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                {post.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
