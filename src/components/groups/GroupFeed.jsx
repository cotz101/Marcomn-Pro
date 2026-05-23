'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { MessageSquare, Send, User } from 'lucide-react';

export default function GroupFeed({ groupId }) {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();
  const { userId } = useProfile();

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_posts')
        .select(`
          *,
          author:profiles!group_posts_user_id_fkey (
            name,
            avatar_url
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Error fetching posts:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchPosts();
    }
  }, [groupId]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting || !userId) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('group_posts')
        .insert({
          group_id: groupId,
          user_id: userId,
          content: content.trim()
        })
        .select(`
          *,
          author:profiles!group_posts_user_id_fkey (
            name,
            avatar_url
          )
        `)
        .maybeSingle();

      if (error) throw error;

      // Optimistic/Immediate UI update
      setPosts(prev => [data, ...prev]);
      setContent('');
    } catch (err) {
      alert('Error creating post: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Post Composer */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <form onSubmit={handleCreatePost}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share something with the group..."
            className="w-full min-h-[100px] p-3 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none mb-3"
            disabled={isSubmitting}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-sm ${
                !content.trim() || isSubmitting
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[#002b4e] text-white hover:bg-[#001f38]'
              }`}
            >
              <Send size={16} />
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Feed List */}
      <div className="space-y-4 pb-20">
        {posts.length > 0 ? (
          posts.map((post) => (
            <div key={post.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-blue-100">
                  {post.author?.avatar_url ? (
                    <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} className="text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-[#0e2a4d] truncate">
                    {post.author?.name || 'Anonymous User'}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                    {new Date(post.created_at).toLocaleDateString()} at {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {post.content}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium text-sm">No posts yet. Be the first to share!</p>
          </div>
        )}
      </div>
    </div>
  );
}
