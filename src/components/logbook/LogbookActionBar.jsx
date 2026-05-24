'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, Loader2, MoreVertical } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function LogbookActionBar({ post, userId, onEditClick, onDeleteSuccess }) {
  const [deleting, setDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-100 rounded-lg shadow-lg z-50 py-1 flex flex-col animate-fadeIn">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onEditClick();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <Edit2 size={14} />
            <span className="font-sans font-medium">Edit Post</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              handleDelete();
            }}
            disabled={deleting}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            <span className="font-sans font-medium">Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
