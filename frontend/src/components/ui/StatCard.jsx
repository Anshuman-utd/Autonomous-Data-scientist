import React from 'react';
import { Card } from './Card';

export const StatCard = ({ 
  label, 
  value, 
  icon: Icon, 
  description,
  trend,
  className
}) => {
  return (
    <Card className={className} hoverable>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white tracking-tight leading-none">{value}</p>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
        
        {Icon && (
          <div className="p-3 bg-slate-900 border border-border rounded-xl text-primary shadow-inner">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 pt-4 border-t border-border flex items-center space-x-2 text-xs">
          <span className={trend.positive ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
            {trend.value}
          </span>
          <span className="text-slate-500">{trend.label}</span>
        </div>
      )}
    </Card>
  );
};
