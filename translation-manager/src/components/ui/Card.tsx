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
      className={`bg-surface rounded-2xl border border-border-light hover:border-primary-hover/30 transition-all duration-300 shadow-md ${paddings[padding]} ${className}`}
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
    <div className={`border-b border-border-light pb-5 mb-5 ${className}`} {...props}>
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
    <h3 className={`text-lg font-semibold text-text-main tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}
