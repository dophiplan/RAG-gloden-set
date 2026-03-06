import { HTMLAttributes, memo } from 'react';
import { TranslationStatus, STATUS_COLORS } from '@/types';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  status?: TranslationStatus;
}

function BadgeComponent({
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
    default: 'bg-white text-text-secondary border border-border-light shadow-sm',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100 shadow-sm',
    error: 'bg-red-50 text-red-700 border border-red-100 shadow-sm',
    info: 'bg-primary-light text-primary-hover border border-primary/20 shadow-sm',
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

const Badge = memo(BadgeComponent);
Badge.displayName = 'Badge';
export default Badge;
