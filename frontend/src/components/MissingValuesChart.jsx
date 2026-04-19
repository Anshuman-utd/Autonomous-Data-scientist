import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function MissingValuesChart({ missing }) {
  const data = useMemo(() => {
    if (!missing) return [];
    return Object.entries(missing)
      .map(([col, count]) => ({ col, count }))
      .sort((a, b) => b.count - a.count); // sort descending
  }, [missing]);

  const hasMissing = data.some(d => d.count > 0);

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col h-[400px]">
      <h3 className="text-xl font-bold mb-4 text-white">Missing Values</h3>
      <div className="flex-grow w-full">
        {!hasMissing ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            No missing values found in the dataset! 🎉
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis dataKey="col" type="category" width={100} stroke="#94a3b8" tick={{fontSize: 12}} />
              <Tooltip 
                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#ef4444' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
