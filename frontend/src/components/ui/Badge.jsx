import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Badge = ({ 
  className, 
  variant = 'info', 
  children, 
  ...props 
}) => {
  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold select-none",
          {
            "bg-blue-500/10 text-blue-400 border border-blue-500/20": variant === 'info',
            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20": variant === 'success',
            "bg-amber-500/10 text-amber-400 border border-amber-500/20": variant === 'warning',
            "bg-red-500/10 text-red-400 border border-red-500/20": variant === 'danger',
            "bg-slate-800 text-slate-300 border border-slate-700": variant === 'neutral',
          }
        ),
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
