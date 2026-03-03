'use client';

import { useTheme } from '@/context/ThemeContext';
import { ButtonHTMLAttributes, forwardRef, useCallback } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className = '', 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    disabled = false, 
    onClick,
    children, 
    ...props 
  }, ref) => {
    const { theme } = useTheme();
    
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

    // Theme-aware variants
    const variants = {
      primary: theme === 'white' 
        ? 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900 active:scale-95 shadow-sm'
        : 'bg-[#818CF8] text-white hover:bg-[#6366F1] focus:ring-[#818CF8] active:scale-95 shadow-md',
      secondary: theme === 'white'
        ? 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-400 shadow-sm'
        : 'bg-white text-[#2C3E50] border-2 border-[#E0E7FF] hover:border-[#818CF8] hover:bg-[#E0E7FF] focus:ring-[#818CF8]/20',
      danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 shadow-sm',
      ghost: theme === 'white'
        ? 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        : 'bg-transparent text-[#546E7A] hover:bg-[#E0E7FF] hover:text-[#6366F1]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (loading || disabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      },
      [loading, disabled, onClick]
    );

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={isDisabled}
        onClick={handleClick}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            role="status"
            aria-label="로딩 중"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
