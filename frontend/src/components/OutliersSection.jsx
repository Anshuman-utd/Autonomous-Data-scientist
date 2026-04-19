import React from 'react';
import { Target } from 'lucide-react';

export default function OutliersSection({ outliers }) {
  if (!outliers || Object.keys(outliers).length === 0) return null;

  const cols = Object.keys(outliers);

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col">
      <div className="flex items-center space-x-3 mb-6">
        <Target className="w-6 h-6 text-red-400" />
        <h3 className="text-xl font-bold text-white">Outliers Detection (IQR Method)</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cols.map((col) => {
          const info = outliers[col];
          return (
            <div key={col} className="bg-slate-900/50 p-5 rounded-xl border border-red-500/10">
              <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-2">
                <h4 className="font-semibold text-slate-200 truncate pr-2">{col}</h4>
                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-md font-medium shrink-0">
                  {info.count} Outliers
                </span>
              </div>
              
              <div className="text-xs text-slate-400 space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Lower Bound:</span>
                  <span className="text-slate-300">{info.lower_bound.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Upper Bound:</span>
                  <span className="text-slate-300">{info.upper_bound.toFixed(2)}</span>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium">Extreme Values Preview:</p>
                <div className="flex flex-wrap gap-2">
                  {info.values.map((val, idx) => (
                    <span key={idx} className="bg-slate-800 text-slate-300 text-[10px] px-2 py-1 rounded-sm border border-slate-700">
                      {typeof val === 'number' ? val.toFixed(2) : val}
                    </span>
                  ))}
                  {info.count > info.values.length && (
                    <span className="text-[10px] text-slate-500 self-center">
                      +{info.count - info.values.length} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
