'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { DialogContext } from './DialogContext';

export function Dialog({
  isOpen,
  onClose,
  children,
  disableBackdropClick = false,
  disableEscapeKey = false,
  initialFocusRef,
  className = '',
}) {
  const generatedId = useId();
  const [titleId, setTitleId] = useState(`dialog-title-${generatedId}`);
  const [descriptionId, setDescriptionId] = useState(undefined);

  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  // Preserve and restore focus to triggering element
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    } else if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
      try {
        triggerRef.current.focus();
      } catch {
        // Safe catch if element was unmounted
      }
      triggerRef.current = null;
    }
  }, [isOpen]);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow || 'unset';
    };
  }, [isOpen]);

  // Handle Escape key dismissal and Focus Trapping
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (!disableEscapeKey && !disableBackdropClick) {
          e.preventDefault();
          onClose?.();
        }
        return;
      }

      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;

        const focusables = root.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !root.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !root.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Initial focus on mount
    const timer = setTimeout(() => {
      if (initialFocusRef?.current && typeof initialFocusRef.current.focus === 'function') {
        initialFocusRef.current.focus();
      } else if (dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0].focus();
        }
      }
    }, 40);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, disableEscapeKey, disableBackdropClick, onClose, initialFocusRef]);

  if (!isOpen) return null;

  return (
    <DialogContext.Provider
      value={{
        isOpen,
        onClose,
        disableBackdropClick,
        disableEscapeKey,
        titleId,
        setTitleId,
        descriptionId,
        setDescriptionId,
      }}
    >
      <div
        ref={dialogRef}
        className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 overflow-y-auto overflow-x-hidden bg-black/55 backdrop-blur-xs transition-opacity duration-200 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] ${className}`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !disableBackdropClick) {
            onClose?.();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {children}
      </div>
    </DialogContext.Provider>
  );
}

export default Dialog;
