'use client';

import { X } from 'lucide-react';
import { useDialogContext } from './DialogContext';
import { DialogTitle } from './DialogTitle';
import { DialogDescription } from './DialogDescription';

export function DialogHeader({
  children,
  title,
  description,
  icon,
  variant = 'navy',
  showCloseButton = false,
  onClose: customOnClose,
  className = '',
  ...props
}) {
  const { onClose: contextOnClose, disableBackdropClick } = useDialogContext();
  const handleClose = customOnClose || contextOnClose;

  const isNavy = variant === 'navy';
  const isDestructive = variant === 'destructive';

  const containerBg = isNavy
    ? 'bg-[#002b4e] text-white'
    : isDestructive
    ? 'bg-rose-50 border-b border-rose-100 text-rose-950'
    : 'bg-white border-b border-slate-100 text-slate-900';

  const closeBtnClass = isNavy
    ? 'text-white/80 hover:text-white hover:bg-white/10 active:scale-95'
    : isDestructive
    ? 'text-rose-400 hover:text-rose-700 hover:bg-rose-100/60 active:scale-95'
    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95';

  return (
    <div
      className={`dialog-header-gutters px-5 sm:px-6 py-4 sm:py-4.5 flex items-center justify-center shrink-0 relative ${containerBg} ${className}`}
      {...props}
    >
      <div className={`w-full flex flex-col items-center justify-center text-center min-w-0 ${showCloseButton ? 'dialog-header-has-close' : ''}`}>
        <div className="flex items-center justify-center gap-2 max-w-full">
          {icon && (
            <div className="shrink-0 flex items-center justify-center">
              {icon}
            </div>
          )}
          {title && (
            <DialogTitle
              className={`text-center truncate ${
                isNavy ? 'text-white' : isDestructive ? 'text-rose-900' : 'text-[#002b4e]'
              }`}
            >
              {title}
            </DialogTitle>
          )}
        </div>
        {description && (
          <DialogDescription
            className={`text-center mt-1 ${
              isNavy ? 'text-slate-200/90' : isDestructive ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            {description}
          </DialogDescription>
        )}
        {children}
      </div>

      {showCloseButton && (
        <button
          type="button"
          onClick={handleClose}
          disabled={disableBackdropClick}
          aria-label="Close dialog"
          className={`dialog-close-btn absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer border-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-30 disabled:cursor-not-allowed ${closeBtnClass}`}
        >
          <X size={20} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

export default DialogHeader;
