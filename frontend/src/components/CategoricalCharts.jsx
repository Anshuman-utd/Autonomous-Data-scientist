import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function CategoricalCharts({ categorical }) {
  if (!categorical || Object.keys(categorical).length === 0) return null;

  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-sm mt-8">
      <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-4">
        Categorical Features Breakdown
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Object.entries(categorical).map(([col, data], index) => {
          if (!data || data.length === 0) return null;
          
          return (
            <div key={col} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-300 mb-4">{col}</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12 }} 
                      width={100}
                    />
                    <Tooltip 
                      cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={30}>
                      {data.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={colors[(index + i) % colors.length]} />
                      ))}
                    </Bar>
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
