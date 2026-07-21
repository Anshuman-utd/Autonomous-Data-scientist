import React from 'react';
import { Button } from './Button';

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  className
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-2xl bg-card/25 backdrop-blur-sm ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-border flex items-center justify-center text-slate-500 mb-4 shadow-inner">
          <Icon className="w-6 h-6" />
        </div>
      )}
      
      <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6 leading-relaxed">
        {description}
      </p>
      
      {actionText && onAction && (
        <Button onClick={onAction} size="sm" variant="secondary">
          {actionText}
        </Button>
      )}
    </div>
  );
};
