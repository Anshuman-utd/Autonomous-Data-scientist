import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DistributionCharts({ distributions }) {
  if (!distributions || Object.keys(distributions).length === 0) return null;

  // Render a max of 6 distributions to avoid massive scrolling
  const cols = Object.keys(distributions).slice(0, 6);

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col">
      <h3 className="text-xl font-bold mb-6 text-white text-center md:text-left">Distributions (Histograms)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cols.map((col) => {
          const data = distributions[col];
          return (
            <div key={col} className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <h4 className="text-center text-sm font-semibold text-slate-300 mb-4 truncate" title={col}>
                {col}
              </h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="bin" 
                      tick={{fontSize: 10, fill: '#64748b'}} 
                      axisLine={{stroke: '#334155'}}
                      tickLine={false}
                      // Hiding some ticks if there are many bins to prevent overlapping
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{fontSize: 10, fill: '#64748b'}} 
                      axisLine={{stroke: '#334155'}}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.02)'}}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#38bdf8' }}
                    />
                    <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
