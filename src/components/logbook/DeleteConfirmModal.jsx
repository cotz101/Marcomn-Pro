'use client';

import { X, AlertTriangle } from 'lucide-react';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, loading }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Delete post?</h2>
          <button className="btn-close" onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ 
            backgroundColor: '#fff5f5', 
            width: '48px', 
            height: '48px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px',
            color: '#dc3545'
          }}>
            <AlertTriangle size={24} />
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Are you sure you want to permanently delete this post? This action cannot be undone.
          </p>
        </div>

        <div className="modal-footer" style={{ padding: '12px 24px', gap: '12px' }}>
          <button 
            className="btn-secondary" 
            onClick={onClose}
            disabled={loading}
            style={{ borderRadius: '24px', border: '1px solid #ddd', color: '#666' }}
          >
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={onConfirm}
            disabled={loading}
            style={{ 
              borderRadius: '24px', 
              backgroundColor: '#dc3545', 
              border: 'none',
              color: '#fff'
            }}
          >
            {loading ? 'Deleting...' : 'Delete Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
