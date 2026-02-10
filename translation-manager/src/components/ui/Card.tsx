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
  const paddings = {
    none: '',
    sm: 'p-5',
    md: 'p-7',
    lg: 'p-9',
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-[#E0E7FF] hover:border-[#6366F1]/30 transition-all duration-300 ${paddings[padding]} ${className}`}
      style={{
        boxShadow: '0 4px 16px rgba(99, 102, 241, 0.08), 0 2px 8px rgba(99, 102, 241, 0.04)'
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
  return (
    <div className={`border-b border-[#E0E7FF] pb-5 mb-5 ${className}`} {...props}>
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
    <h3 className={`text-lg font-semibold text-[#2C3E50] tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}
