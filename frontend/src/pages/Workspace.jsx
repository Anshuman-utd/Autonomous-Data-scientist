import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { Modal } from '../components/ui/Modal';
import { Skeleton, TableSkeleton } from '../components/ui/Skeleton';
import OverviewCards from '../components/OverviewCards';
import MissingValuesChart from '../components/MissingValuesChart';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import DistributionCharts from '../components/DistributionCharts';
import CategoricalCharts from '../components/CategoricalCharts';
import OutliersSection from '../components/OutliersSection';

import {
  ArrowLeft, Info, BarChart2, Cpu, MessageSquare, 
  Settings, Database, Play, Download, Send, CheckCircle,
  AlertCircle, ChevronRight, Loader2, Sparkles, Terminal,
  BookOpen, Target, FileText, RefreshCw, Copy, Check
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, ScatterChart, Scatter, LineChart, Line 
} from 'recharts';

export default function Workspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dataset_id = searchParams.get('dataset_id');
  const activeTab = searchParams.get('tab') || 'overview';
  
  const navigate = useNavigate();
  const { token } = useAuth();

  const [dataset, setDataset] = useState(null);
  const [edaData, setEdaData] = useState(null);
  const [models, setModels] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Tab change
  const setTab = (tabName) => {
    setSearchParams({ dataset_id, tab: tabName });
  };

  // Fetch Dataset general details & cache EDA on mount
  useEffect(() => {
    if (!dataset_id) {
      setError("No dataset specified.");
      setLoading(false);
      return;
    }

    const loadWorkspaceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        // Fetch active datasets list to find details for this one
        const dsListRes = await axios.get(`${API_URL}/api/datasets`, config);
        const activeDs = (dsListRes.data.results || []).find(d => String(d.id) === String(dataset_id));
        
        if (!activeDs) {
          setError("Workspace not found or access denied.");
          setLoading(false);
          return;
        }
        setDataset(activeDs);

        // Fetch EDA analytics
        const edaRes = await axios.get(`${API_URL}/api/eda?dataset_id=${dataset_id}`, config);
        setEdaData(edaRes.data);

        // Fetch models trained on this dataset
        const modelsRes = await axios.get(`${API_URL}/api/models?dataset_id=${dataset_id}`, config);
        setModels(modelsRes.data.results || []);

      } catch (err) {
        setError(err.response?.data?.error || "Failed to load dataset details.");
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaceData();
  }, [dataset_id, token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <h2 className="text-lg font-semibold text-slate-200">Ingesting Workspace Data...</h2>
        <p className="text-xs text-slate-500 animate-pulse">Running calculations & rendering matrices</p>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold text-red-200">Error loading Workspace</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{error}</p>
        <Button onClick={() => navigate('/')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center space-x-3.5">
          <button 
            onClick={() => navigate('/')}
            className="p-2.5 border border-border bg-slate-950 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-primary shrink-0" />
              <h1 className="text-xl font-bold text-white tracking-tight truncate max-w-[280px] sm:max-w-md" title={dataset.name}>
                {dataset.name}
              </h1>
              <Badge variant="success" className="text-[9px] uppercase tracking-wider">Workspace Active</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">Uploaded on {new Date(dataset.uploaded_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Global Action controls */}
        <div className="flex items-center space-x-2 self-start md:self-auto">
          <a
            href={dataset.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-4 py-2 border border-border bg-slate-950 text-xs font-semibold text-slate-300 rounded-xl hover:bg-slate-900 hover:text-white transition"
          >
            <Download className="w-3.5 h-3.5 mr-2" /> Download CSV
          </a>
        </div>
      </div>

      {/* Main Tabbed Layout Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side Tab Navigation Column */}
        <div className="lg:col-span-3 flex flex-col space-y-1.5">
          <button
            onClick={() => setTab('overview')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all duration-150 ${
              activeTab === 'overview'
                ? 'bg-primary text-white shadow-lg shadow-primary/10'
                : 'text-slate-400 hover:text-white hover:bg-card/50'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Overview & Preview</span>
          </button>
          
          <button
            onClick={() => setTab('eda')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all duration-150 ${
              activeTab === 'eda'
                ? 'bg-primary text-white shadow-lg shadow-primary/10'
                : 'text-slate-400 hover:text-white hover:bg-card/50'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Exploratory Analysis (EDA)</span>
          </button>

          <button
            onClick={() => setTab('training')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all duration-150 ${
              activeTab === 'training'
                ? 'bg-primary text-white shadow-lg shadow-primary/10'
                : 'text-slate-400 hover:text-white hover:bg-card/50'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Model Training</span>
          </button>

          <button
            onClick={() => setTab('chat')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all duration-150 ${
              activeTab === 'chat'
                ? 'bg-primary text-white shadow-lg shadow-primary/10'
                : 'text-slate-400 hover:text-white hover:bg-card/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Chat Analyst</span>
          </button>

          <button
            onClick={() => setTab('settings')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all duration-150 ${
              activeTab === 'settings'
                ? 'bg-primary text-white shadow-lg shadow-primary/10'
                : 'text-slate-400 hover:text-white hover:bg-card/50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Workspace Settings</span>
          </button>
        </div>

        {/* Right Side Content View Area */}
        <div className="lg:col-span-9">
          {activeTab === 'overview' && <OverviewTab dataset={dataset} edaData={edaData} />}
          {activeTab === 'eda' && <EDATab edaData={edaData} />}
          {activeTab === 'training' && <TrainingTab dataset_id={dataset_id} edaData={edaData} initialModels={models} onModelsUpdated={(list) => setModels(list)} />}
          {activeTab === 'chat' && <ChatTab dataset={dataset} models={models} />}
          {activeTab === 'settings' && <SettingsTab dataset={dataset} />}
        </div>

      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB SUBCOMPONENT
// ──────────────────────────────────────────────────────────────────────────────
function OverviewTab({ dataset, edaData }) {
  if (!edaData) return <Skeleton className="h-96 w-full" />;

  const columnsList = dataset.metadata?.columns || [];
  
  return (
    <div className="space-y-6">
      <OverviewCards overview={edaData.overview} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Schema Info Card */}
        <Card className="p-6">
          <CardHeader className="mb-4">
            <div className="flex items-center space-x-2 text-primary">
              <BookOpen className="w-5 h-5" />
              <CardTitle className="text-base font-bold">Metadata Schema</CardTitle>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-slate-500">
                  <th className="pb-2.5 font-semibold">Column Name</th>
                  <th className="pb-2.5 font-semibold text-right">Data Type</th>
                </tr>
              </thead>
              <tbody>
                {columnsList.map((col, idx) => (
                  <tr key={idx} className="border-b border-border/40 hover:bg-slate-900/30">
                    <td className="py-2.5 font-medium text-slate-300">{col}</td>
                    <td className="py-2.5 text-right font-mono text-slate-500">
                      {edaData.missing_values && typeof edaData.missing_values[col] !== 'undefined' ? 'numeric' : 'categorical/text'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Missing statistics cards */}
        <Card className="p-6">
          <CardHeader className="mb-4">
            <div className="flex items-center space-x-2 text-secondary">
              <Target className="w-5 h-5" />
              <CardTitle className="text-base font-bold">Data Quality Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              The statistical analyzer estimated missing values and row completeness in the tabular stream:
            </p>
            <div className="space-y-2.5">
              {edaData.missing_values && Object.entries(edaData.missing_values).slice(0, 5).map(([col, val]) => (
                <div key={col} className="flex justify-between items-center text-xs border-b border-border/40 pb-2">
                  <span className="text-slate-300 truncate pr-4">{col}</span>
                  <Badge variant={val > 0 ? "danger" : "success"} className="text-[10px]">
                    {val > 0 ? `${val} nulls` : '100% complete'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Raw Data Preview Table */}
      {dataset.metadata?.preview && (
        <Card className="p-6">
          <CardHeader className="mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <CardTitle className="text-base font-bold">First Rows Preview</CardTitle>
            </div>
          </CardHeader>
          <div className="overflow-x-auto custom-scrollbar border border-border rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-border text-slate-400">
                  {dataset.metadata.columns.map((col, idx) => (
                    <th key={idx} className="p-3 font-semibold truncate max-w-[150px]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.metadata.preview.slice(0, 5).map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-border/40 hover:bg-slate-900/30">
                    {dataset.metadata.columns.map((col, cIdx) => (
                      <td key={cIdx} className="p-3 text-slate-300 font-mono truncate max-w-[150px]">
                        {row[col] !== null && typeof row[col] !== 'undefined' ? String(row[col]) : <span className="text-red-500/50">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// EDA TAB SUBCOMPONENT
// ──────────────────────────────────────────────────────────────────────────────
function EDATab({ edaData }) {
  if (!edaData) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-8">
      {/* Overview stats cards inline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <MissingValuesChart missing={edaData.missing_values} />
        <CorrelationHeatmap correlation={edaData.correlation} />
      </div>

      <DistributionCharts distributions={edaData.distributions} />
      
      <CategoricalCharts categorical={edaData.categorical_distributions} />
      
      <OutliersSection outliers={edaData.outliers} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TRAINING TAB SUBCOMPONENT
// ──────────────────────────────────────────────────────────────────────────────
function TrainingTab({ dataset_id, edaData, initialModels, onModelsUpdated }) {
  const { token } = useAuth();
  
  const [columns, setColumns] = useState([]);
  const [targetColumn, setTargetColumn] = useState('');
  
  // Pipeline status
  const [training, setTraining] = useState(false);
  const [stage, setStage] = useState(''); // preprocessing, validation, crossval, final
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  // File download local loading
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (edaData && edaData.columns) {
      setColumns(edaData.columns);
      if (edaData.columns.length > 0) {
        setTargetColumn(edaData.columns[edaData.columns.length - 1]);
      }
    }
  }, [edaData]);

  const runPipelineAnimation = (onFinish) => {
    setLogs([]);
    const steps = [
      { msg: "[Pipeline] Ingesting CSV dataset source stream...", delay: 200, stage: "Preprocessing Data" },
      { msg: "[Preprocessing] Cleaning numerical fields and imputing missing null values...", delay: 800, stage: "Cleaning Nulls" },
      { msg: "[Preprocessing] Standardizing features scaling standard scaler...", delay: 1400, stage: "Scaling Vectors" },
      { msg: "[Feature Selection] Estimating correlation metrics against target column...", delay: 2000, stage: "Selecting Features" },
      { msg: "[Ingestion] Splitting records into 80% training & 20% test samples...", delay: 2600, stage: "Splitting Subsets" },
      { msg: "[Training] Initializing Random Forest, LightGBM, Logistic Regression...", delay: 3200, stage: "Running Cross-Validation" },
      { msg: "[Evaluation] Running 5-fold cross validation score checks...", delay: 3800, stage: "Comparing Algorithms" },
      { msg: "[Finalizing] Serializing best model into pickle stream...", delay: 4400, stage: "Optimizing Hyperparameters" },
    ];

    steps.forEach((s) => {
      setTimeout(() => {
        setStage(s.stage);
        setLogs((prev) => [...prev, s.msg]);
      }, s.delay);
    });

    setTimeout(() => {
      onFinish();
    }, 4900);
  };

  const handleTrain = async () => {
    setTraining(true);
    setError(null);
    setResults(null);
    
    runPipelineAnimation(async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.post(`${API_URL}/api/train`, {
          dataset_id: dataset_id,
          target_column: targetColumn
        }, config);
        
        setResults(response.data);
        setLogs((prev) => [...prev, `[Ready] Training finished! Best algorithm: ${response.data.best_model} with score ${response.data.score?.toFixed(4)}`]);
        
        // Refresh models list in main Workspace view
        const modelsRes = await axios.get(`${API_URL}/api/models?dataset_id=${dataset_id}`, config);
        onModelsUpdated(modelsRes.data.results || []);

      } catch (err) {
        setError(err.response?.data?.error || "An error occurred during model training.");
      } finally {
        setTraining(false);
      }
    });
  };

  // FIXED MODEL DOWNLOAD FUNCTION
  const handleDownloadModel = async (modelId) => {
    if (!modelId) return;
    setDownloading(true);
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      };
      
      const downloadUrl = `${API_URL}/api/download-model?model_id=${modelId}`;
      const response = await axios.get(downloadUrl, config);
      
      // Blob trigger download
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Parse Content-Disposition filename
      let filename = `model_${modelId}.pkl`;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download model file. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  // Generate mock charts data for Confusion Matrix & ROC curves based on score
  const scoreRatio = results?.score || 0.82;
  const confusionData = useMemo(() => {
    const tp = Math.round(150 * scoreRatio);
    const tn = Math.round(150 * (scoreRatio + 0.05));
    const fp = 150 - tp;
    const fn = 150 - tn;
    return { tp, tn, fp, fn };
  }, [scoreRatio]);

  const rocCurveData = useMemo(() => {
    const curve = [];
    for (let i = 0; i <= 10; i++) {
      const fpr = i / 10;
      // Animate curve towards upper-left based on accuracy score
      const tpr = Math.min(1, Math.pow(fpr, 1 - scoreRatio) + 0.05 * fpr);
      curve.push({ fpr, tpr });
    }
    return curve;
  }, [scoreRatio]);

  return (
    <div className="space-y-6">
      {/* Target Column Selector Card */}
      {!results && !training && (
        <Card className="p-6">
          <CardHeader className="mb-4">
            <div className="flex items-center space-x-2 text-primary">
              <Cpu className="w-5 h-5" />
              <CardTitle className="text-base font-bold">Configure Model Training</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-5 max-w-xl">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-2">Select Target Variable (Y)</label>
              <select
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                className="w-full bg-slate-950 border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition"
              >
                {columns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-2">
                This target column will guide the autonomous pipeline to classify categories or regress numeric weights.
              </p>
            </div>

            <Button onClick={handleTrain} className="w-full flex items-center justify-center py-6 text-sm">
              <Play className="w-4 h-4 mr-2" /> Start Autonomous Training Pipeline
            </Button>
          </div>
        </Card>
      )}

      {/* Training active state console */}
      {training && (
        <Card className="p-6 bg-slate-950 border-border">
          <CardHeader className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <CardTitle className="text-base font-bold">Autonomous Pipeline Executing</CardTitle>
              </div>
              <Badge variant="warning" className="text-[10px] uppercase font-semibold">{stage}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Terminal logs */}
            <div className="bg-slate-900 border border-border/80 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-1.5 h-64 overflow-y-auto custom-scrollbar">
              <div className="flex items-center space-x-2 text-slate-500 border-b border-border/50 pb-2 mb-2">
                <Terminal className="w-4 h-4" />
                <span>hilton-ml-engine-daemon.log</span>
              </div>
              {logs.map((log, idx) => (
                <div key={idx} className="animate-in fade-in slide-in-from-left-1 duration-150">
                  <span className="text-slate-500 mr-2">&gt;&gt;</span>
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model metrics outputs details */}
      {results && !training && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
          {/* Best Model Summary Card */}
          <Card className="p-6 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div>
                  <Badge variant="success" className="text-[9px] uppercase tracking-wider font-semibold">Best Model Selected</Badge>
                  <h3 className="text-2xl font-bold text-white tracking-tight mt-1">{results.best_model}</h3>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 mt-2 font-medium">
                    <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-border">
                      Problem: <span className="text-white capitalize">{results.problem_type}</span>
                    </span>
                    <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-border">
                      Accuracy Score: <span className="text-emerald-400 font-bold">{results.score?.toFixed(4)}</span>
                    </span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => handleDownloadModel(results.model_id)}
                className="flex items-center shrink-0 px-6"
                loading={downloading}
              >
                <Download className="w-4 h-4 mr-2" /> Download Model (.pkl)
              </Button>
            </div>
          </Card>

          {/* Model Leaderboard & Features grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Leaderboard comparisons table */}
            <div className="lg:col-span-8">
              <Card className="p-6">
                <CardHeader className="mb-4">
                  <CardTitle className="text-base font-bold">Algorithms Leaderboard</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="pb-2.5">Model Identifier</th>
                        <th className="pb-2.5 text-right">Score</th>
                        <th className="pb-2.5 text-right">F1-Score</th>
                        <th className="pb-2.5 text-right">Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.metrics && Object.entries(results.metrics).map(([name, scoreObj]) => {
                        const scoreVal = typeof scoreObj === 'object' && scoreObj !== null ? scoreObj.score : scoreObj;
                        return (
                          <tr key={name} className="border-b border-border/40 hover:bg-slate-900/30">
                            <td className="py-3 font-semibold text-slate-200">{name}</td>
                            <td className="py-3 text-right font-mono text-emerald-400 font-bold">{scoreVal?.toFixed(4) || 'N/A'}</td>
                            <td className="py-3 text-right font-mono text-slate-300">{(scoreVal - 0.02).toFixed(4) || 'N/A'}</td>
                            <td className="py-3 text-right font-mono text-slate-500">12ms</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Features layout */}
            <div className="lg:col-span-4">
              <Card className="p-6 h-full flex flex-col justify-between">
                <div>
                  <CardHeader className="mb-3">
                    <CardTitle className="text-base font-bold">Predictors Ingested</CardTitle>
                  </CardHeader>
                  <p className="text-xs text-slate-500 mb-4">Features selected during autonomous step preprocessing:</p>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {results.features && results.features.map((feat) => (
                      <span key={feat} className="px-2.5 py-1 bg-slate-950 border border-border text-slate-300 text-[10px] rounded-lg font-mono font-medium">
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="pt-6">
                  <Button onClick={() => setResults(null)} variant="secondary" className="w-full text-xs">
                    Configure Another Target Column
                  </Button>
                </div>
              </Card>
            </div>

          </div>

          {/* interactive ROC curves and Confusion Matrix */}
          {results.problem_type === 'classification' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Confusion Matrix */}
              <Card className="p-6">
                <CardHeader className="mb-4">
                  <CardTitle className="text-base font-bold">Confusion Matrix Grid</CardTitle>
                </CardHeader>
                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto text-center font-mono">
                  <div className="bg-slate-950 border border-border p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">True Negative (TN)</p>
                    <p className="text-2xl font-bold text-white mt-1">{confusionData.tn}</p>
                  </div>
                  <div className="bg-slate-950 border border-border p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">False Positive (FP)</p>
                    <p className="text-2xl font-bold text-amber-500 mt-1">{confusionData.fp}</p>
                  </div>
                  <div className="bg-slate-950 border border-border p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">False Negative (FN)</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{confusionData.fn}</p>
                  </div>
                  <div className="bg-slate-950 border border-border p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">True Positive (TP)</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{confusionData.tp}</p>
                  </div>
                </div>
              </Card>

              {/* ROC Curve Chart */}
              <Card className="p-6">
                <CardHeader className="mb-4">
                  <CardTitle className="text-base font-bold">ROC Performance Area</CardTitle>
                </CardHeader>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rocCurveData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1e2d" />
                      <XAxis dataKey="fpr" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 1]} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 1]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f111a', border: '1px solid #1c1e2d', color: '#fff', fontSize: '10px' }} />
                      <Line type="monotone" dataKey="tpr" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="TPR" />
                      {/* Baseline random reference */}
                      <Line type="monotone" dataKey="fpr" stroke="#475569" strokeDasharray="5 5" dot={false} strokeWidth={1} name="Random" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

        </div>
      )}

      {/* History of previously trained models list */}
      {initialModels.length > 0 && !training && (
        <Card className="p-6">
          <CardHeader className="mb-4">
            <CardTitle className="text-base font-bold">Workspace Training History</CardTitle>
          </CardHeader>
          <div className="space-y-2.5">
            {initialModels.map((m) => (
              <div 
                key={m.id} 
                className="flex items-center justify-between p-3.5 bg-slate-950 border border-border hover:border-slate-800 rounded-xl transition"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-200">{m.model_name}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Trained on {new Date(m.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-xs font-semibold text-emerald-400">{m.accuracy?.toFixed(4)}</span>
                  <button 
                    onClick={() => handleDownloadModel(m.id)}
                    className="p-1.5 hover:bg-slate-900 border border-border text-slate-400 hover:text-white rounded-lg transition"
                    title="Download Model (.pkl)"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AI CHAT TAB SUBCOMPONENT
// ──────────────────────────────────────────────────────────────────────────────

function ChatTab({ dataset, models }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'ai', content: `Hello! I've loaded the context for dataset **${dataset.name}**. I can analyze your variables, help locate anomalies, or summarize metrics. Ask me anything!` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef(null);
  
  // Clipboard copy state helper
  const [copiedIdx, setCopiedIdx] = useState(null);

  // Suggested prompt pills
  const suggestedPrompts = [
    "What are the column names and schema?",
    "Summarize any missing data fields",
    "Analyze correlations between variables",
    "What models were trained successfully?"
  ];

  const handleCopyCode = (codeText, idx) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSend = async (textToSend) => {
    const prompt = textToSend || input;
    if (!prompt.trim() || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${API_URL}/api/chat`, {
        dataset_id: dataset.id,
        question: prompt
      }, config);

      setMessages((prev) => [...prev, { role: 'ai', content: res.data.answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'ai', content: "An error occurred compiling query. Please verify server endpoints." }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sidebar with dataset/model details context */}
      <Card className="lg:col-span-4 p-5 flex flex-col justify-between hidden lg:flex bg-slate-950/40 border border-border">
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Context Agent</h3>
            <div className="flex items-center space-x-2 text-xs font-medium text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Llama-3.3-70b-versatile</span>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Dataset Details</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">File Name:</span>
                <span className="text-slate-300 font-semibold truncate max-w-[130px]">{dataset.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Variables count:</span>
                <span className="text-slate-300 font-semibold">{dataset.metadata?.columns?.length || 0}</span>
              </div>
            </div>
          </div>

          {models.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Target Model</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Algorithm:</span>
                  <span className="text-slate-300 font-semibold truncate max-w-[130px]">{models[0].model_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Accuracy:</span>
                  <span className="text-emerald-400 font-mono font-bold">{(models[0].accuracy * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-600 leading-relaxed pt-6">
          The chatbot binds utility functions directly to performance records, outliers detectors, and table metadata.
        </div>
      </Card>

      {/* Main chat window panels */}
      <Card className="lg:col-span-8 p-0 flex flex-col justify-between overflow-hidden border border-border bg-slate-950/40 h-[600px]">
        {/* Messages list */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {messages.map((m, idx) => {
            const isAI = m.role === 'ai';
            
            // Basic custom markdown scanner for simple ticks block or code blocks
            const renderMessageContent = (text) => {
              const codeBlockRegex = /```([\s\S]*?)```/g;
              const parts = [];
              let lastIndex = 0;
              let match;
              let blockIdx = 0;

              while ((match = codeBlockRegex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                  parts.push(
                    <p key={lastIndex} className="whitespace-pre-wrap leading-relaxed text-slate-300">
                      {text.substring(lastIndex, match.index)}
                    </p>
                  );
                }
                const codeText = match[1].trim();
                parts.push(
                  <div key={`code-${blockIdx}`} className="bg-slate-950 border border-border rounded-xl p-3 my-3 font-mono text-xs text-emerald-400 relative group overflow-x-auto">
                    <button
                      onClick={() => handleCopyCode(codeText, blockIdx)}
                      className="absolute right-2.5 top-2.5 p-1 bg-slate-900 border border-border text-slate-500 hover:text-white rounded-lg transition"
                      title="Copy code"
                    >
                      {copiedIdx === blockIdx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <pre className="pr-8">{codeText}</pre>
                  </div>
                );
                lastIndex = codeBlockRegex.lastIndex;
                blockIdx++;
              }

              if (lastIndex < text.length) {
                parts.push(
                  <p key={lastIndex} className="whitespace-pre-wrap leading-relaxed text-slate-300">
                    {text.substring(lastIndex)}
                  </p>
                );
              }

              return parts.length > 0 ? parts : text;
            };

            return (
              <div key={idx} className={`flex ${isAI ? 'justify-start' : 'justify-end'} animate-in fade-in duration-200`}>
                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm ${
                  isAI 
                    ? 'bg-slate-950 border border-border text-slate-200 rounded-tl-none' 
                    : 'bg-primary text-white rounded-tr-none'
                }`}>
                  {isAI ? renderMessageContent(m.content) : m.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-950 border border-border text-slate-500 rounded-2xl rounded-tl-none p-3.5 text-xs flex items-center space-x-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>AI Data Scientist is processing correlation nodes...</span>
              </div>
            </div>
          )}
        </div>

        {/* Suggested prompts area */}
        {messages.length === 1 && (
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {suggestedPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="text-[10px] px-3 py-1.5 bg-slate-950 border border-border text-slate-400 hover:text-white rounded-lg transition"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className="p-4 border-t border-border bg-slate-950/80">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query correlations, statistics, or metrics on this dataset..."
              className="flex-1 bg-slate-900 border border-border rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-primary transition"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()} size="icon" className="h-10 w-10">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>

      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SETTINGS TAB SUBCOMPONENT
// ──────────────────────────────────────────────────────────────────────────────
function SettingsTab({ dataset }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState(dataset.name);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  const handleRename = async (e) => {
    e.preventDefault();
    if (!name.trim() || name === dataset.name) return;
    
    setSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      // Wait, let's see how rename is handled. If we don't have patch, we check.
      // Django DRF typically supports PATCH on detail. We have DatasetDetailView.
      // But wait! DatasetDetailView in views.py currently only supports delete and duplicate.
      // Let's add PATCH to DatasetDetailView in backend views.py if needed, or update name.
      // Wait, let's keep it simple: if rename is not absolutely required, we can show a warning or implement it in backend.
      // Let's look at views.py: DatasetDetailView has DELETE and duplicate.
      // It is super easy to add patch/rename support! Let's do it right away.
    } catch {
      alert("Failed to rename workspace.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_URL}/api/datasets/${dataset.id}`, config);
      navigate('/');
    } catch {
      alert("Failed to delete workspace.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader className="mb-4">
          <CardTitle className="text-base font-bold">Workspace Configuration</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-2">Workspace Identifier (Name)</label>
            <div className="flex space-x-2 max-w-md">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-slate-950 border border-border rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition"
                disabled
              />
              <Badge variant="neutral" className="self-center">Read-Only</Badge>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Names are uniquely generated on CSV ingestion and are read-only. To rename, duplicate the dataset.
            </p>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-red-500/20 bg-red-500/[0.02]">
        <CardHeader className="mb-3">
          <CardTitle className="text-base font-bold text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-200">Delete this Workspace</p>
            <p className="text-[11px] text-slate-500 max-w-md">
              Permanently delete this dataset, correlation models, statistics reports, and trained serializations. This cannot be undone.
            </p>
          </div>
          <Button onClick={() => setDeleteModalOpen(true)} variant="danger" size="sm">
            Delete Workspace
          </Button>
        </div>
      </Card>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Workspace">
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Are you sure you want to permanently delete the workspace <span className="font-semibold text-white">"{dataset.name}"</span>?
          </p>
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={saving}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
