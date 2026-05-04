'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function PostActions({ postId, onEdit, onDeleteSuccess }) {
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
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
      setIsDeleting(false);
    } else {
      onDeleteSuccess();
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="post-menu-container" ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        className="post-menu-btn"
        style={{ 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer', 
          padding: '4px', 
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center'
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <MoreVertical size={16} />
      </button>
      
      {isOpen && (
        <div className="post-menu-dropdown" style={{ 
          position: 'absolute', 
          top: '100%', 
          right: 0, 
          backgroundColor: '#fff', 
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 100,
          width: '140px',
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 0'
        }}>
          <button 
            className="post-menu-item"
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: '#333',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
              textAlign: 'left',
              width: '100%'
            }}
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
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: '#cc0000',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
              textAlign: 'left',
              width: '100%'
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsDeleteModalOpen(true);
            }}
          >
            <Trash2 size={14} /> Delete Post
          </button>
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
