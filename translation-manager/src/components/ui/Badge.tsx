import { HTMLAttributes } from 'react';
import { TranslationStatus, STATUS_COLORS } from '@/types';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  status?: TranslationStatus;
}

export default function Badge({
  className = '',
  variant = 'default',
  status,
  children,
  ...props
}: BadgeProps) {
  // If status is provided, use status colors
  if (status) {
    const statusStyle = STATUS_COLORS[status];
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text} ${className}`}
        {...props}
      >
        {children || statusStyle.label}
      </span>
    );
  }

  const variants = {
    default: 'bg-white/80 text-[#64748B] border border-[#C8E6C9]',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    error: 'bg-red-50 text-red-700 border border-red-200',
    info: 'bg-[#E8F5E9] text-[#5FA654] border border-[#7BC96F]/20',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
