'use client';

import { useTheme } from '@/context/ThemeContext';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({
  className = '',
  padding = 'md',
  children,
  ...props
}: CardProps) {
  const { theme } = useTheme();
  
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-200 ${paddings[padding]} ${className}`}
      style={{
        borderColor: theme === 'white' ? '#E5E7EB' : '#E0E7FF',
        boxShadow: theme === 'white' 
          ? '0 1px 3px rgba(0, 0, 0, 0.08)' 
          : '0 2px 8px rgba(129, 140, 248, 0.08)',
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { theme } = useTheme();
  
  return (
    <div 
      className={`border-b pb-4 mb-4 ${className}`} 
      style={{ borderColor: theme === 'white' ? '#E5E7EB' : '#E0E7FF' }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-lg font-semibold text-[var(--text-main)] tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}
