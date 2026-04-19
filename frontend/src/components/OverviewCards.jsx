import React from 'react';
import { Layers, Hash, PieChart, TextSelect } from 'lucide-react';

export default function OverviewCards({ overview }) {
  if (!overview) return null;

  const cards = [
    { label: "Total Rows", value: overview.total_rows, icon: <Layers className="w-6 h-6 text-blue-400" />, color: "border-blue-500/20 bg-blue-500/5" },
    { label: "Total Columns", value: overview.total_columns, icon: <Hash className="w-6 h-6 text-purple-400" />, color: "border-purple-500/20 bg-purple-500/5" },
    { label: "Numeric Cols", value: overview.numeric_columns, icon: <PieChart className="w-6 h-6 text-emerald-400" />, color: "border-emerald-500/20 bg-emerald-500/5" },
    { label: "Categorical Cols", value: overview.categorical_columns, icon: <TextSelect className="w-6 h-6 text-orange-400" />, color: "border-orange-500/20 bg-orange-500/5" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {cards.map((c, i) => (
        <div key={i} className={`p-6 rounded-2xl border ${c.color} flex flex-col justify-center`}>
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-slate-800/80 rounded-lg">
              {c.icon}
            </div>
            <h3 className="text-sm font-medium text-slate-400">{c.label}</h3>
          </div>
          <p className="text-3xl font-bold text-white">{c.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
