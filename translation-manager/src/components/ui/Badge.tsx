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
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
