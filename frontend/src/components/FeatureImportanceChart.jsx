import React from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Sparkles, BarChart3, HelpCircle, Layers } from 'lucide-react';

export default function FeatureImportanceChart({ featureImportance = [], modelName = "Trained Model" }) {
  if (!featureImportance || featureImportance.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 text-slate-400 mb-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-white">Feature Importance & Explainability</h3>
        </div>
        <p className="text-xs text-slate-500">
          Feature weight explainability will become available once a model has been trained.
        </p>
      </Card>
    );
  }

  // Calculate top 3 share
  const top3Sum = featureImportance.slice(0, 3).reduce((acc, curr) => acc + (curr.importance || 0), 0);
  const maxScore = Math.max(...featureImportance.map(f => f.importance || 1), 1);

  return (
    <Card className="p-6">
      <CardHeader className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-primary">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white">Model Explainability & Feature Drivers</CardTitle>
              <p className="text-[11px] text-slate-400">Relative impact of each column on {modelName}'s predictions</p>
            </div>
          </div>
          <Badge variant="default" className="text-[10px] uppercase font-mono tracking-wider">
            Top 3 Drivers: {top3Sum.toFixed(1)}% Share
          </Badge>
        </div>
      </CardHeader>

      {/* Horizontal Bar Chart Representation */}
      <div className="space-y-3.5 mt-2">
        {featureImportance.slice(0, 10).map((item, idx) => {
          const pct = item.importance || 0;
          const relativeWidth = Math.min(100, (pct / maxScore) * 100);

          return (
            <div key={item.feature || idx} className="space-y-1 group">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="font-mono text-slate-300 group-hover:text-white transition flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 w-4 font-mono">#{idx + 1}</span>
                  <span className="truncate max-w-[200px] sm:max-w-xs">{item.feature}</span>
                </span>
                <div className="flex items-center space-x-3">
                  {item.raw_score !== undefined && (
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      weight: {item.raw_score}
                    </span>
                  )}
                  <span className="font-mono text-xs font-bold text-primary group-hover:text-cyan-400 transition">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 w-full bg-slate-900 border border-border/80 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-blue-500 to-cyan-400 transition-all duration-700 ease-out group-hover:brightness-110"
                  style={{ width: `${relativeWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight banner */}
      <div className="mt-5 p-3.5 bg-slate-950/80 border border-border/80 rounded-xl flex items-start space-x-3 text-xs text-slate-400">
        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong className="text-slate-200">Executive Insight:</strong> Columns at the top exert the highest mathematical leverage during inference. Stakeholders can prioritize data quality collection and business decisions on these primary factors.
        </p>
      </div>
    </Card>
  );
}
