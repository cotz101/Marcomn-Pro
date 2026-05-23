'use client';

import { useState } from 'react';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function LogbookActionBar({ post, userId, onEditClick, onDeleteSuccess }) {
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  // Guard: Show ONLY to author
  const isAuthor = (post.author_id === userId) || (post.user_id === userId);
  if (!isAuthor) return null;

  const handleDelete = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete this logbook entry? This action cannot be undone.');
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      console.log('DEBUG: Attempting deletion for post:', post.id);
      const { error } = await supabase
        .from('logbook_posts')
        .delete()
        .eq('id', post.id);

      if (error) {
        console.error('Delete Error:', error);
        alert('Failed to delete post: ' + error.message);
        return;
      }

      console.log('SUCCESS: Post deleted:', post.id);
      if (onDeleteSuccess) {
        onDeleteSuccess(post.id);
      }
    } catch (err) {
      console.error('Critical delete failure:', err);
      alert('An error occurred during deletion.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 pt-3 border-t border-gray-50 mt-4 justify-end">
      <button
        type="button"
        onClick={onEditClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all active:scale-95 cursor-pointer"
      >
        <Edit2 size={13} />
        <span>Edit</span>
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50/50 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
      >
        {deleting ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Trash2 size={13} />
        )}
        <span>Delete</span>
      </button>
    </div>
  );
}
