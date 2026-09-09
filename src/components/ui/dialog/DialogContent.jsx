'use client';

const maxWidthMap = {
  sm: 'max-w-sm',     // ~384px
  md: 'max-w-md',     // ~448px
  lg: 'max-w-lg',     // ~512px
  xl: 'max-w-xl',     // ~576px
  '2xl': 'max-w-2xl', // ~672px
  '3xl': 'max-w-3xl', // ~768px
};

export function DialogContent({
  children,
  maxWidth = 'lg',
  className = '',
  style = {},
  ...props
}) {
  const isNamedSize = typeof maxWidth === 'string' && maxWidth in maxWidthMap;
  const widthClass = isNamedSize ? maxWidthMap[maxWidth] : '';
  const customStyle = isNamedSize ? style : { maxWidth, ...style };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={customStyle}
      className={`relative w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] animate-in fade-in zoom-in-95 duration-200 ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default DialogContent;
