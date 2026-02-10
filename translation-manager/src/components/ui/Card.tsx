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
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-lg border border-[#C8E6C9] hover:shadow-xl transition-all duration-300 ${paddings[padding]} ${className}`}
      style={{
        boxShadow: '0 4px 6px -1px rgba(123, 201, 111, 0.12), 0 2px 4px -1px rgba(123, 201, 111, 0.08)'
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
    <div className={`border-b border-[#E2E8F0] pb-4 mb-4 ${className}`} {...props}>
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
    <h3 className={`text-lg font-semibold text-[#1E293B] ${className}`} {...props}>
      {children}
    </h3>
  );
}
