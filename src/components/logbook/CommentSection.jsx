'use client';

import { useState, useEffect } from 'react';
import { Send, User, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function CommentSection({ postId, userId, profile, onCommentAdded, onCommentDeleted }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState(null);

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
        .order('created_at', { ascending: false });

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
      if (onCommentAdded) onCommentAdded();
    } catch (err) {
      alert('Error posting comment: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!commentToDelete) return;
    
    setDeletingId(commentToDelete);
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentToDelete);

      if (error) throw error;
      
      setComments(comments.filter(c => c.id !== commentToDelete));
      if (onCommentDeleted) onCommentDeleted();
      setIsDeleteModalOpen(false);
      setCommentToDelete(null);
    } catch (err) {
      alert('Error deleting comment: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const openDeleteModal = (id) => {
    setCommentToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const visibleComments = comments.slice(0, visibleCount);
  const hasMore = comments.length > visibleCount;

  return (
    <div className="comment-section" style={{ borderTop: '1px solid #eef3f8', padding: '12px 16px' }}>
      {/* Comment List */}
      <div className="comment-list" style={{ marginBottom: '16px' }}>
        {loading ? (
          <div className="text-sm text-gray-500 py-2">Loading comments...</div>
        ) : comments.length > 0 ? (
          <>
            {visibleComments.map((comment) => (
              <div key={comment.id} className="comment-item flex gap-3 mb-4 last:mb-0">
                <img 
                  src={comment.profiles?.avatar_url || '/profile_pic.png'} 
                  alt={comment.profiles?.full_name} 
                  className="comment-avatar"
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div className="flex-1 flex flex-col gap-1">
                  <div className="comment-bubble" style={{ backgroundColor: '#f2f2f2', padding: '8px 12px', borderRadius: '12px' }}>
                    <div className="flex justify-between items-start">
                      <div className="comment-author" style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1b1c1c' }}>
                        {comment.profiles?.full_name}
                      </div>
                      {(comment.user_id === userId || comment.userId === userId) && (
                        <button 
                          onClick={() => openDeleteModal(comment.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          disabled={deletingId === comment.id}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="comment-text" style={{ fontSize: '0.85rem', color: '#1b1c1c', marginTop: '2px' }}>
                      {comment.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {hasMore && (
              <button 
                onClick={() => setVisibleCount(prev => prev + 5)}
                className="text-sm font-bold text-[#004173] hover:underline mt-2 flex items-center"
              >
                Show more comments
              </button>
            )}
          </>
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

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleDelete}
        loading={deletingId !== null}
        type="comment"
      />
    </div>
  );
}
