'use client';

export function DialogFooter({
  children,
  className = '',
  ...props
}) {
  return (
    <div
      className={`dialog-footer-gutters px-5 sm:px-6 py-4 bg-slate-50/90 border-t border-slate-100/80 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-2.5 sm:gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default DialogFooter;
