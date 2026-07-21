import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Input = React.forwardRef(({ 
  className, 
  type = 'text', 
  error, 
  icon: Icon, 
  ...props 
}, ref) => {
  return (
    <div className="w-full space-y-1.5">
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Icon className="h-4 w-4 text-slate-500" />
          </div>
        )}
        <input
          type={type}
          ref={ref}
          className={twMerge(
            clsx(
              "w-full bg-slate-950 border border-border text-white placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200",
              {
                "pl-10": Icon,
                "px-4": !Icon,
                "py-2.5": true,
                "border-red-500/50 focus:border-red-500 focus:ring-red-500": error
              }
            ),
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-1 animate-in fade-in duration-200">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
