import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, ArrowLeft, AlertCircle, Play, Download, CheckCircle, Database, BarChart3 } from 'lucide-react';
import ModelComparisonTable from '../components/ModelComparisonTable';

export default function ModelTraining() {
  const [searchParams] = useSearchParams();
  const dataset_id = searchParams.get('dataset_id');
  const filename = searchParams.get('filename'); // Fallback purely for display if no DB yet
  const navigate = useNavigate();

  const [columns, setColumns] = useState([]);
  const [targetColumn, setTargetColumn] = useState('');
  const [fetchingCols, setFetchingCols] = useState(true);
  
  const [training, setTraining] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dataset_id && !filename) {
      setError("No dataset specified. Please go back and upload a dataset.");
      setFetchingCols(false);
      return;
    }

    const fetchColumns = async () => {
      try {
        const urlParams = dataset_id ? `dataset_id=${dataset_id}` : `filename=${filename}`;
        const response = await axios.get(`http://localhost:8000/api/eda?${urlParams}`);
        if (response.data.columns) {
          setColumns(response.data.columns);
          // Set last column as default target
          if (response.data.columns.length > 0) {
            setTargetColumn(response.data.columns[response.data.columns.length - 1]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch columns", err);
        // We do not set a blocking error here as we can still default to the backend's choice
      } finally {
        setFetchingCols(false);
      }
    };
    fetchColumns();
  }, [dataset_id, filename]);

  const handleTrain = async () => {
    setTraining(true);
    setError(null);
    setResults(null);
    
    try {
      const response = await axios.post(`http://localhost:8000/api/train`, {
        dataset_id: dataset_id || null,
        filename: filename || null,
        target_column: targetColumn || null
      });
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred during model training.");
    } finally {
      setTraining(false);
    }
  };

  const handleDownloadModel = () => {
    if (results && results.model_download_url) {
      window.open(`http://localhost:8000${results.model_download_url}`, '_blank');
    }
  };

  if (!dataset_id && !filename) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-red-200">{error || "No dataset specified. Please go back and upload a dataset."}</h2>
        <button 
          onClick={() => navigate('/')} 
          className="mt-6 flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Go back to Upload
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <button 
          onClick={() => navigate(`/dashboard?filename=${filename}`)}
          className="flex items-center text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </button>
      </div>

      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-secondary/10 rounded-full mb-4 ring-1 ring-secondary/20">
            <Database className="w-8 h-8 text-secondary" />
        </div>
        <h2 className="text-4xl font-extrabold text-white mb-3">Model Training Pipeline</h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Train multiple machine learning models on <span className="text-white font-semibold">{filename}</span> and let the platform select the best performer autonomously.
        </p>
      </div>

      {!results && !training && (
        <div className="bg-slate-800/60 backdrop-blur-sm p-8 rounded-2xl border border-slate-700/50 shadow-xl max-w-2xl mx-auto">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Select Target Column</label>
              <div className="relative">
                {fetchingCols ? (
                  <div className="w-full h-11 bg-slate-900 rounded-lg animate-pulse border border-slate-700 flex items-center px-4">
                    <span className="text-slate-500 text-sm">Loading columns...</span>
                  </div>
                ) : (
                  <select 
                    value={targetColumn} 
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition appearance-none"
                  >
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                )}
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">The column you want to predict. By default, it's the last column.</p>
            </div>
            
            <button 
              onClick={handleTrain}
              className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-bold rounded-xl shadow-lg transform hover:-translate-y-1 transition duration-200"
            >
              <Play className="w-5 h-5 mr-2" /> Start Autonomous Training
            </button>
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-3 mt-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {training && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50">
          <div className="relative">
             <div className="w-20 h-20 border-4 border-slate-700 rounded-full"></div>
             <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <h2 className="text-2xl font-bold text-white mt-8 mb-2">Training Models...</h2>
          <p className="text-slate-400">Preprocessing data, splitting sets, and comparing ML algorithms.</p>
          <div className="mt-8 flex space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      )}

      {results && !training && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          
          <div className="bg-gradient-to-br from-emerald-500/20 to-blue-500/10 border border-emerald-500/30 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between shadow-xl">
            <div className="flex items-center space-x-6 mb-6 md:mb-0">
              <div className="bg-emerald-500/20 text-emerald-400 p-4 rounded-full">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <p className="text-emerald-400 font-medium tracking-wider text-sm uppercase mb-1">Model Trained Successfully</p>
                <h3 className="text-3xl font-bold text-white mb-2">{results.best_model}</h3>
                <div className="flex space-x-4 text-sm text-slate-300">
                  <span className="bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700 shadow-inner">
                    <span className="text-slate-400 mr-2">Type:</span> 
                    <span className="capitalize text-white font-medium">{results.problem_type}</span>
                  </span>
                  <span className="bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700 shadow-inner">
                    <span className="text-slate-400 mr-2">Score:</span> 
                    <span className="text-white font-medium">{results.score ? results.score.toFixed(4) : 'N/A'}</span>
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleDownloadModel}
              className="flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition"
            >
              <Download className="w-5 h-5 mr-2" /> Download Model (.pkl)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <ModelComparisonTable metrics={results.metrics} problemType={results.problem_type} />
            </div>
            
            <div className="space-y-6">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 h-full">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-slate-900 rounded-lg"><BarChart3 className="w-5 h-5 text-accent" /></div>
                  <h3 className="text-lg font-semibold text-white">Features Included</h3>
                </div>
                <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {results.features && results.features.map(f => (
                    <span key={f} className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs font-medium text-slate-300">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center pt-8">
            <button 
              onClick={() => setResults(null)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition"
            >
              Try Another Target Column
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
