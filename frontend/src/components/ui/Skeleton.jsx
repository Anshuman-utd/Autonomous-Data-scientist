import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={twMerge("animate-pulse bg-slate-900 border border-border/30 rounded-xl", className)}
      {...props}
    />
  );
};

export const TableSkeleton = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full space-y-4">
      <div className="flex space-x-4">
        {Array.from({ length: cols }).map((_, idx) => (
          <Skeleton key={idx} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex space-x-4">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton key={cIdx} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};
