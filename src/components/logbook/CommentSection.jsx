'use client';

import { useState, useEffect } from 'react';
import { Send, User } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function CommentSection({ postId, userId, profile }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Error fetching comments:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: userId,
          content: newComment.trim()
        })
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;
      
      setComments([...comments, data]);
      setNewComment('');
    } catch (err) {
      alert('Error posting comment: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comment-section" style={{ borderTop: '1px solid #eef3f8', padding: '12px 16px' }}>
      {/* Comment List */}
      <div className="comment-list" style={{ marginBottom: '16px' }}>
        {loading ? (
          <div className="text-sm text-gray-500 py-2">Loading comments...</div>
        ) : comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="comment-item flex gap-3 mb-4 last:mb-0">
              <img 
                src={comment.profiles?.avatar_url || '/profile_pic.png'} 
                alt={comment.profiles?.full_name} 
                className="comment-avatar"
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div className="comment-bubble" style={{ backgroundColor: '#f2f2f2', padding: '8px 12px', borderRadius: '12px', flex: 1 }}>
                <div className="comment-author" style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1b1c1c' }}>
                  {comment.profiles?.full_name}
                </div>
                <div className="comment-text" style={{ fontSize: '0.85rem', color: '#1b1c1c', marginTop: '2px' }}>
                  {comment.content}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500 py-2">No comments yet. Be the first to reply!</div>
        )}
      </div>

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 items-start" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <img 
          src={profile?.profilePic || '/profile_pic.png'} 
          alt="Me" 
          className="comment-avatar"
          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
        />
        <div className="relative flex-1 flex items-center">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full border border-gray-200 rounded-2xl px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#002b4e] transition-all bg-gray-50"
            rows="1"
            style={{ resize: 'none', minHeight: '38px', maxHeight: '120px', overflowY: 'auto' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />
          <button 
            type="submit" 
            disabled={!newComment.trim() || submitting}
            className="absolute right-3 p-1 text-[#002b4e] disabled:opacity-30 flex items-center justify-center"
            style={{ height: '32px', width: '32px' }}
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
