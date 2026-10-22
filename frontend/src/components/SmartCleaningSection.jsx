import React, { useState, useMemo } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  Wand2, Trash2, CheckCircle2, AlertTriangle, 
  ArrowRight, Loader2, Sparkles, RefreshCw, Scissors
} from 'lucide-react';

export default function SmartCleaningSection({ datasetId, edaData, onDataCleaned }) {
  const { token } = useAuth();
  const [activeAction, setActiveAction] = useState(null);
  const [lastDiff, setLastDiff] = useState(null);
  const [error, setError] = useState(null);

  // Generate intelligent suggestions dynamically from EDA metrics
  const suggestions = useMemo(() => {
    if (!edaData) return [];
    const list = [];

    // 1. Outlier Suggestions
    const outliers = edaData.outliers || {};
    Object.entries(outliers).forEach(([col, info]) => {
      const count = info?.count || 0;
      if (count > 0) {
        list.push({
          id: `outlier_${col}`,
          action: 'remove_outliers',
          column: col,
          type: 'outlier',
          label: `Remove ${count} outliers in ${col}`,
          badge: `-${count} rows`,
          badgeVariant: 'warning',
          icon: Scissors,
          description: `Filters ${count} anomalous data points exceeding 1.5x IQR boundaries.`
        });
      }
    });

    // 2. Missing Value Suggestions
    const missing = edaData.missing_values || {};
    Object.entries(missing).forEach(([col, count]) => {
      if (count > 0) {
        list.push({
          id: `impute_${col}`,
          action: 'impute_missing',
          column: col,
          strategy: 'median',
          type: 'impute',
          label: `Impute missing values in ${col}`,
          badge: `${count} nulls`,
          badgeVariant: 'default',
          icon: Wand2,
          description: `Fills ${count} empty values using statistical median imputation.`
        });
      }
    });

    // 3. High Correlation / Redundancy Suggestions
    const correlations = edaData.correlation || [];
    const redundantPairs = [];
    correlations.forEach((item) => {
      if (item.x !== item.y && Math.abs(item.value) > 0.92) {
        // avoid duplicate pair reporting
        const pairKey = [item.x, item.y].sort().join('__');
        if (!redundantPairs.includes(pairKey)) {
          redundantPairs.push(pairKey);
          list.push({
            id: `drop_${item.x}`,
            action: 'drop_columns',
            columns: [item.x],
            type: 'redundant',
            label: `Drop redundant column ${item.x}`,
            badge: `${(item.value * 100).toFixed(0)}% corr with ${item.y}`,
            badgeVariant: 'destructive',
            icon: Trash2,
            description: `Collinear with ${item.y}. Dropping reduces multi-collinearity variance.`
          });
        }
      }
    });

    // 4. General Duplicate Cleaner
    list.push({
      id: 'remove_dups',
      action: 'remove_duplicates',
      type: 'duplicates',
      label: 'Deduplicate identical records',
      badge: 'integrity',
      badgeVariant: 'secondary',
      icon: Sparkles,
      description: 'Removes all duplicate row observations across all columns.'
    });

    return list;
  }, [edaData]);

  const handleApplyTransform = async (suggestion) => {
    setActiveAction(suggestion.id);
    setError(null);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const payload = {
        action: suggestion.action,
        column: suggestion.column,
        columns: suggestion.columns,
        strategy: suggestion.strategy
      };

      const res = await axios.post(`${API_URL}/api/datasets/${datasetId}/transform`, payload, config);
      
      setLastDiff({
        message: res.data.message,
        rowsBefore: res.data.rows_before,
        rowsAfter: res.data.rows_after,
        colsBefore: res.data.cols_before,
        colsAfter: res.data.cols_after
      });

      if (onDataCleaned) {
        onDataCleaned(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to apply transformation.");
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-r from-blue-950/20 via-slate-900/60 to-cyan-950/20 border-primary/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
            <Wand2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white tracking-tight">Automated Smart Cleaning Suggestions</h3>
              <Badge variant="success" className="text-[9px] uppercase font-mono">1-Click Transforms</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Autonomous detections from Exploratory Data Analysis. Click any chip to clean the dataset in-place for training.
            </p>
          </div>
        </div>

        {lastDiff && (
          <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{lastDiff.message} ({lastDiff.rowsAfter} rows, {lastDiff.colsAfter} cols)</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-2.5 pt-1">
        {suggestions.length > 0 ? (
          suggestions.map((sug) => {
            const Icon = sug.icon;
            const isLoading = activeAction === sug.id;

            return (
              <button
                key={sug.id}
                onClick={() => handleApplyTransform(sug)}
                disabled={activeAction !== null}
                className="group relative flex items-center space-x-2.5 px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 border border-border/80 hover:border-primary/50 text-slate-200 hover:text-white rounded-xl text-xs font-medium transition-all duration-150 disabled:opacity-50 shadow-sm hover:shadow-primary/5"
                title={sug.description}
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                ) : (
                  <Icon className="w-3.5 h-3.5 text-primary group-hover:text-cyan-400 transition" />
                )}
                <span>{sug.label}</span>
                <span className="px-1.5 py-0.5 bg-slate-950 text-[10px] text-slate-400 rounded-md font-mono border border-border/60">
                  {sug.badge}
                </span>
              </button>
            );
          })
        ) : (
          <p className="text-xs text-slate-400">All columns are clean and normalized. No automated corrections needed.</p>
        )}
      </div>
    </Card>
  );
}
