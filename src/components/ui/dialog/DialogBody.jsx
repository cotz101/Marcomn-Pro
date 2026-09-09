'use client';

export function DialogBody({
  children,
  className = '',
  ...props
}) {
  return (
    <div
      className={`dialog-body-gutters px-5 sm:px-6 py-5 sm:py-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-sm text-slate-700 leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default DialogBody;
