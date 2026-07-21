import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card = ({ 
  className, 
  hoverable = false, 
  children, 
  ...props 
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          "glass-panel p-6 bg-card border border-border transition-all duration-350",
          {
            "hover:border-slate-700 hover:shadow-subtle-glow hover:-translate-y-0.5": hoverable
          }
        ),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ className, children, ...props }) => (
  <div className={twMerge("mb-4 flex items-center justify-between", className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...props }) => (
  <h3 className={twMerge("text-lg font-bold text-white tracking-tight", className)} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ className, children, ...props }) => (
  <div className={twMerge("text-sm text-slate-300 leading-relaxed", className)} {...props}>
    {children}
  </div>
);
