'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function BaseModal({ isOpen, onClose, title, children, maxWidth = '600px', disableBackdropClick = false }) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-glass" onClick={disableBackdropClick ? undefined : onClose}>
      <div 
        className="modal-content-standard" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth }}
      >
        <div className="modal-header-navy">
          <h2 className="modal-title-white">{title}</h2>
          <button className="modal-close-btn-white" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body-standard">
          {children}
        </div>
      </div>
    </div>
  );
}
