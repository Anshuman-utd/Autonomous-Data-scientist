import React, { useState, useRef } from 'react';
import { UploadCloud, File, X, Loader2 } from 'lucide-react';
import axios from 'axios';
import API_URL from '../config/api';

export default function FileUpload({ onUploadSuccess, onUploadError }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    if (selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      onUploadError(null);
    } else {
      setFile(null);
      onUploadError("Please upload a valid CSV file.");
    }
  };

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData);
      onUploadSuccess(response.data);
    } catch (err) {
      const errorMsg = err.response?.data?.error || "An error occurred while uploading.";
      onUploadError(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Drop Zone */}
      <div 
        className={`relative group border-2 border-dashed rounded-2xl p-6 transition-all duration-300 ease-in-out text-center shrink-0 ${
          dragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-border bg-slate-950 hover:border-slate-800'
        } ${file ? 'py-4' : 'py-10'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept=".csv" 
          onChange={handleChange} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
          disabled={isUploading || file !== null}
        />
        
        {!file ? (
          <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
            <div className="p-3 bg-slate-900 border border-border rounded-xl group-hover:scale-105 transition-transform duration-300">
              <UploadCloud className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Click or drag CSV file to upload
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Upload a structured tabular dataset (.csv) up to 50MB
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-border rounded-xl relative z-10">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-lg">
                <File className="w-5 h-5 shrink-0" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/20 rounded-lg transition shrink-0"
              disabled={isUploading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Upload Action */}
      {file && (
        <button 
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-xl transition duration-200 flex justify-center items-center text-sm shadow-lg shadow-primary/10"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Processing Dataset...
            </>
          ) : (
            'Analyze Dataset'
          )}
        </button>
      )}
    </div>
  );
}
