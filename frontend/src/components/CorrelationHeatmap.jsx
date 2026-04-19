import React, { useMemo } from 'react';

export default function CorrelationHeatmap({ correlation }) {
  const { labels, gridInfo } = useMemo(() => {
    if (!correlation || correlation.length === 0) return { labels: [], gridInfo: null };

    // Extract unique labels
    const labelSet = new Set();
    correlation.forEach(c => {
      labelSet.add(c.x);
      labelSet.add(c.y);
    });
    const labels = Array.from(labelSet);

    // Create a 2D lookup map
    const map = {};
    correlation.forEach(c => {
      if (!map[c.y]) map[c.y] = {};
      map[c.y][c.x] = c.value;
    });

    return { labels, gridInfo: map };
  }, [correlation]);

  // Color mapper (-1 to 1) 
  // Blue for negative, white near 0, Red for positive
  const getColor = (value) => {
    if (value === null || value === undefined) return 'rgba(0,0,0,0)';
    
    if (value > 0) {
      // Red scales
      const intensity = Math.min(1, value);
      return `rgba(239, 68, 68, ${intensity})`; // red-500
    } else {
      // Blue scales
      const intensity = Math.min(1, Math.abs(value));
      return `rgba(59, 130, 246, ${intensity})`; // blue-500
    }
  };

  if (!correlation || correlation.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-2xl flex flex-col h-[400px]">
        <h3 className="text-xl font-bold mb-4 text-white">Correlation Matrix</h3>
        <div className="flex-grow flex flex-col items-center justify-center text-slate-400">
          <p>Not enough numerical columns</p>
          <p className="text-sm mt-1">Need at least 2 numeric columns for correlation.</p>
        </div>
      </div>
    );
  }

  // Max 8-10 columns look good in this manual grid, otherwise we need scrolling
  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Correlation Matrix</h3>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <div className="w-3 h-3 bg-blue-500 rounded-sm"></div> <span>Negative</span>
          <div className="w-3 h-3 border border-slate-600 rounded-sm ml-2"></div> <span>0</span>
          <div className="w-3 h-3 bg-red-500 rounded-sm ml-2"></div> <span>Positive</span>
        </div>
      </div>

      <div className="overflow-x-auto w-full flex-grow flex items-center justify-center">
        <div className="inline-block mt-4">
           {/* Top Headers */}
           <div className="flex ml-24">
             {labels.map((col, i) => (
                <div key={`header-${i}`} className="w-12 md:w-16 h-28 transform -rotate-45 origin-bottom-left flex items-end ml-1">
                  <span className="text-xs text-slate-300 font-medium truncate w-32 pb-4 border-b border-transparent">
                    {col}
                  </span>
                </div>
             ))}
           </div>

           {/* Rows */}
           {labels.map((rowLabel, i) => (
             <div key={`row-${i}`} className="flex items-center mt-1">
               <div className="w-24 text-xs font-medium text-slate-300 text-right pr-4 truncate" title={rowLabel}>
                 {rowLabel}
               </div>
               <div className="flex">
                 {labels.map((colLabel, j) => {
                   const val = gridInfo?.[rowLabel]?.[colLabel];
                   return (
                     <div 
                        key={`cell-${i}-${j}`}
                        className="w-12 md:w-16 h-12 md:h-16 flex items-center justify-center ml-1 rounded-md text-[10px] md:text-sm font-semibold border border-slate-800/50 hover:border-slate-400 transition-colors"
                        style={{ backgroundColor: getColor(val) }}
                        title={`${rowLabel} & ${colLabel}: ${val?.toFixed(3)}`}
                     >
                       {val !== undefined && Math.abs(val) > 0.3 ? val.toFixed(1) : ''}
                     </div>
                   )
                 })}
               </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
