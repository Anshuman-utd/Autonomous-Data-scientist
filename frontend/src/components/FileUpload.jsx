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
    
    // Using FormData to send the file
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Authorization header is set globally by AuthContext (axios.defaults).
      // Do NOT pass a custom headers object here — it would override the Bearer token.
      // Axios auto-sets multipart/form-data with the correct boundary for FormData.
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
        className={`relative group !border-2 border-dashed rounded-xl p-8 transition-all duration-300 ease-in-out text-center shrink-0 ${
          dragActive 
            ? 'border-primary bg-primary/10' 
            : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
        } ${file ? 'py-6' : 'py-12'}`}
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
          <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
            <div className="p-4 bg-slate-700/50 rounded-full group-hover:scale-110 transition-transform duration-300">
              <UploadCloud className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-200">
                Click or drag file to this area to upload
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Support for a single or bulk CSV dataset.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 relative z-10">
            <div className="flex items-center space-x-4 overflow-hidden">
              <File className="w-8 h-8 text-secondary shrink-0" />
              <div className="text-left overflow-hidden">
                <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition-colors shrink-0 disabled:opacity-50"
              disabled={isUploading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Upload Action */}
      {file && (
        <button 
          onClick={handleUpload}
          disabled={isUploading}
          className="glass-button w-full py-4 rounded-xl flex justify-center items-center font-semibold tracking-wide"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            'Analyze Dataset'
          )}
        </button>
      )}
    </div>
  );
}
