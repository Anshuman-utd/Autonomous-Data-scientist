import React from 'react';
import { TableProperties } from 'lucide-react';

export default function DataPreview({ columns, preview }) {
  if (!columns || !preview) return null;

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-2xl h-full flex flex-col items-start overflow-hidden">
      <div className="mb-6 flex space-x-3 items-center">
        <div className="p-3 bg-secondary/20 rounded-xl">
          <TableProperties className="w-6 h-6 text-secondary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Data Preview</h2>
          <p className="text-sm text-slate-400 font-medium">{columns.length} Columns detected</p>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/50">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-300 uppercase bg-slate-800/80">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} scope="col" className="px-6 py-4 font-semibold tracking-wider whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {preview.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-800/40 transition-colors">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-6 py-4 text-slate-300 whitespace-nowrap">
                    {/* Render object or string properly; replace null with 'NaN/null' */}
                    {row[col] !== null && row[col] !== undefined 
                      ? String(row[col]) 
                      : <span className="text-slate-500 italic">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {preview.length > 0 && (
        <div className="mt-4 w-full text-center">
          <p className="text-xs text-slate-500">Showing first {preview.length} rows</p>
        </div>
      )}
    </div>
  );
}
