import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import FileUpload from '../components/FileUpload';
import DataPreview from '../components/DataPreview';
import {
  Database, AlertCircle, BarChart2,
  FolderOpen, Clock, RefreshCcw, ChevronRight,
} from 'lucide-react';

export default function UploadPage() {
  const [dataset, setDataset]       = useState(null);
  const [error, setError]           = useState(null);
  const [myDatasets, setMyDatasets] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const navigate = useNavigate();

  // ── Load user's existing datasets ──────────────────────────────────────────
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/datasets');
        setMyDatasets(res.data.results || []);
      } catch {
        // Non-fatal — just hide the panel
      } finally {
        setLoadingList(false);
      }
    };
    fetchDatasets();
  }, []);

  const handleUploadSuccess = (data) => {
    setError(null);
    setDataset(data);
    // Refresh the datasets list after a new upload
    axios.get('http://localhost:8000/api/datasets')
      .then(r => setMyDatasets(r.data.results || []))
      .catch(() => {});
  };

  const handleUploadError = (err) => {
    setError(err);
    setDataset(null);
  };

  const goToDashboard = (id) => {
    navigate(`/dashboard?dataset_id=${id}`);
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── Left: Upload Area ─────────────────────────────────────────── */}
        <div className={`${dataset ? 'lg:col-span-4' : 'lg:col-span-5'} transition-all duration-500`}>
          <div className="glass-panel p-6 sm:p-8 rounded-2xl h-full flex flex-col">
            <div className="mb-6 flex space-x-3 items-center">
              <div className="p-3 bg-primary/20 rounded-xl">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white">Upload Dataset</h2>
            </div>

            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />

            {/* Resumed dataset toast */}
            {dataset?.resumed && (
              <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center space-x-3">
                <RefreshCcw className="w-4 h-4 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-200">{dataset.message}</p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {dataset && (
              <div className="mt-6 pt-6 border-t border-slate-800">
                <button
                  onClick={() => goToDashboard(dataset.dataset_id)}
                  className="w-full bg-secondary hover:bg-secondary/90 text-white py-4 rounded-xl flex justify-center items-center font-semibold tracking-wide transition-colors"
                >
                  <BarChart2 className="w-5 h-5 mr-2" />
                  View EDA Dashboard
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Data Preview or My Datasets ───────────────────────── */}
        <div className={`${dataset ? 'lg:col-span-8' : 'lg:col-span-7'} space-y-6`}>

          {/* Preview panel (shown after upload / resume) */}
          {dataset && dataset.columns && (
            <div className="animate-in zoom-in-95 duration-500">
              <DataPreview columns={dataset.columns} preview={dataset.preview} />
            </div>
          )}

          {/* My Datasets panel */}
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2 bg-secondary/20 rounded-lg">
                <FolderOpen className="w-5 h-5 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-white">My Datasets</h3>
              <span className="ml-auto text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
                {myDatasets.length} dataset{myDatasets.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loadingList ? (
              <div className="py-8 text-center text-slate-500 text-sm animate-pulse">
                Loading your datasets…
              </div>
            ) : myDatasets.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                No datasets yet. Upload your first CSV above.
              </div>
            ) : (
              <ul className="space-y-2">
                {myDatasets.map((ds) => (
                  <li key={ds.id}>
                    <button
                      onClick={() => goToDashboard(ds.id)}
                      className="w-full group flex items-center px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 hover:border-slate-600 transition-all duration-200 text-left"
                    >
                      <div className="p-2 bg-slate-700 group-hover:bg-primary/20 rounded-lg mr-3 transition-colors">
                        <Database className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium text-slate-200 truncate">{ds.name}</p>
                        <div className="flex items-center mt-0.5 space-x-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(ds.uploaded_at)}</span>
                          {ds.metadata?.columns?.length > 0 && (
                            <span className="text-slate-600">·</span>
                          )}
                          {ds.metadata?.columns?.length > 0 && (
                            <span>{ds.metadata.columns.length} columns</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors ml-2 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
