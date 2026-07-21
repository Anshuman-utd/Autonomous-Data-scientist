import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Button = React.forwardRef(({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  children, 
  disabled, 
  type = 'button',
  ...props 
}, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/45 disabled:opacity-50 disabled:cursor-not-allowed",
          {
            // Variants
            "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/10 hover:shadow-primary/20": variant === 'primary',
            "bg-slate-900 border border-border text-slate-200 hover:bg-slate-800 hover:text-white": variant === 'secondary',
            "bg-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200": variant === 'ghost',
            "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white": variant === 'danger',
            
            // Sizes
            "px-3 py-1.5 text-xs rounded-lg": size === 'sm',
            "px-4 py-2.5 text-sm": size === 'md',
            "px-6 py-3.5 text-base": size === 'lg',
            "p-2": size === 'icon',
          }
        ),
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
