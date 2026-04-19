import React from 'react';

const ModelComparisonTable = ({ metrics, problemType }) => {
  if (!metrics || Object.keys(metrics).length === 0) return null;

  const metricName = problemType === 'classification' ? 'Accuracy' : 'R² Score';

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <h3 className="text-lg font-semibold text-white">Model Comparison</h3>
        <p className="text-sm text-slate-400">Comparison of trained models based on {metricName}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="px-6 py-4 text-sm font-medium text-slate-300 border-b border-slate-700">Model</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-300 border-b border-slate-700">Score ({metricName})</th>
              {problemType === 'regression' && (
                 <th className="px-6 py-4 text-sm font-medium text-slate-300 border-b border-slate-700">RMSE</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-slate-300">
            {Object.entries(metrics).map(([modelName, metricData]) => (
              <tr key={modelName} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 text-sm font-medium">{modelName}</td>
                <td className="px-6 py-4 text-sm">
                  {metricData.score ? metricData.score.toFixed(4) : 'N/A'}
                </td>
                {problemType === 'regression' && (
                  <td className="px-6 py-4 text-sm">
                    {metricData.rmse ? metricData.rmse.toFixed(4) : 'N/A'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModelComparisonTable;
