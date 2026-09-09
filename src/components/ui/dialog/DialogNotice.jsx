'use client';

import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

const variantStyles = {
  info: {
    container: 'bg-blue-50/80 border-blue-200/80 text-blue-950',
    iconColor: 'text-[#004173]',
    titleColor: 'text-[#002b4e]',
    defaultIcon: Info,
  },
  warning: {
    container: 'bg-amber-50/80 border-amber-200/80 text-amber-950',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
    defaultIcon: AlertTriangle,
  },
  destructive: {
    container: 'bg-rose-50/80 border-rose-200/80 text-rose-950',
    iconColor: 'text-rose-600',
    titleColor: 'text-rose-900',
    defaultIcon: AlertCircle,
  },
  success: {
    container: 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-900',
    defaultIcon: CheckCircle2,
  },
  neutral: {
    container: 'bg-slate-50 border-slate-200 text-slate-800',
    iconColor: 'text-slate-500',
    titleColor: 'text-slate-900',
    defaultIcon: Info,
  },
};

export function DialogNotice({
  variant = 'info',
  icon: customIcon,
  title,
  children,
  description,
  className = '',
  ...props
}) {
  const current = variantStyles[variant] || variantStyles.info;
  const DefaultIcon = current.defaultIcon;

  return (
    <div
      className={`rounded-xl border p-4 sm:p-4.5 flex items-start gap-3.5 transition-colors ${current.container} ${className}`}
      {...props}
    >
      <div className={`shrink-0 mt-0.5 ${current.iconColor}`}>
        {customIcon !== undefined ? customIcon : <DefaultIcon size={20} />}
      </div>
      <div className="flex-1 min-w-0 space-y-1 text-sm">
        {title && (
          <div className={`font-bold leading-tight ${current.titleColor}`}>
            {title}
          </div>
        )}
        {children && (
          <div className="leading-relaxed">
            {children}
          </div>
        )}
        {description && (
          <div className="text-xs opacity-85 leading-normal pt-0.5">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

export default DialogNotice;
