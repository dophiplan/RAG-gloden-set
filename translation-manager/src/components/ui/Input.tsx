import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-semibold text-[#1E293B] mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`
            block w-full px-4 py-2.5 border rounded-lg shadow-sm
            placeholder-[#94A3B8] text-[#1E293B] bg-white
            focus:outline-none focus:ring-3 transition-all duration-200
            ${error
              ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
              : 'border-[#C8E6C9] focus:ring-[#7BC96F]/15 focus:border-[#7BC96F]'
            }
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
