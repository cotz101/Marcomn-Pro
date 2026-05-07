'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function PostActions({ postId, isAuthor, onEdit, onDeleteSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef(null);
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      
      if (error) throw error;
      
      if (onDeleteSuccess) {
        onDeleteSuccess(postId); // Pass ID for optimistic filtering
      }
      setIsDeleteModalOpen(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="post-menu-container" ref={menuRef}>
      <button 
        className="post-menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <MoreVertical size={16} />
      </button>
      
      {isOpen && (
        <div className="post-menu-dropdown">
          {isAuthor ? (
            <>
              <button 
                className="post-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                  setIsOpen(false);
                }}
              >
                <Edit2 size={14} /> Edit Post
              </button>
              <button 
                className="post-menu-item delete"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteModalOpen(true);
                }}
              >
                <Trash2 size={14} /> Delete Post
              </button>
            </>
          ) : (
            <>
              <button 
                className="post-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              >
                Report Post
              </button>
              <button 
                className="post-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              >
                Copy Link
              </button>
            </>
          )}
        </div>
      )}

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  );
}
