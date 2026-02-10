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
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text} shadow-sm ${className}`}
        {...props}
      >
        {children || statusStyle.label}
      </span>
    );
  }

  const variants = {
    default: 'bg-white text-[#546E7A] border border-[#E0E7FF] shadow-sm',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100 shadow-sm',
    error: 'bg-red-50 text-red-700 border border-red-100 shadow-sm',
    info: 'bg-[#E0E7FF] text-[#6366F1] border border-[#818CF8]/20 shadow-sm',
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
