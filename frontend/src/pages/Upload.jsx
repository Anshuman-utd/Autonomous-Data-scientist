import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import DataPreview from '../components/DataPreview';
import { Database, AlertCircle, BarChart2 } from 'lucide-react';

export default function UploadPage() {
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleUploadSuccess = (data) => {
    setError(null);
    setDataset(data);
  };

  const handleUploadError = (err) => {
    setError(err);
    setDataset(null);
  };

  const goToDashboard = () => {
    if (dataset && dataset.file_name) {
      navigate(`/dashboard?filename=${dataset.file_name}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Upload Area */}
        <div className={`${dataset ? 'lg:col-span-4' : 'lg:col-span-12'} transition-all duration-500`}>
          <div className="glass-panel p-6 sm:p-8 rounded-2xl h-full flex flex-col justify-center">
            <div className="mb-6 flex space-x-3 items-center">
              <div className="p-3 bg-primary/20 rounded-xl">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white">Dataset</h2>
            </div>
            
            <FileUpload 
              onUploadSuccess={handleUploadSuccess} 
              onUploadError={handleUploadError} 
            />
            
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}
            
            {dataset && (
              <div className="mt-8 pt-6 border-t border-slate-800">
                <button 
                  onClick={goToDashboard}
                  className="w-full bg-secondary hover:bg-secondary/90 text-white py-4 rounded-xl flex justify-center items-center font-semibold tracking-wide transition-colors"
                >
                  <BarChart2 className="w-5 h-5 mr-2" />
                  View EDA Dashboard
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview Area */}
        {dataset && (
          <div className="lg:col-span-8 space-y-6 animate-in zoom-in-95 duration-500 delay-150">
            <DataPreview columns={dataset.columns} preview={dataset.preview} />
          </div>
        )}
        
      </div>
    </div>
  );
}
