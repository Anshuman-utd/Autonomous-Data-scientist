import React, { useState } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  Download, Terminal, FileCode, Check, Copy, 
  Server, Layers, Box, Cpu, ExternalLink, Sparkles
} from 'lucide-react';

export default function DeploymentExportTab({ dataset, models = [] }) {
  const { token } = useAuth();
  const [selectedModelId, setSelectedModelId] = useState(models[0]?.id || null);
  const [downloading, setDownloading] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState('fastapi');
  const [copied, setCopied] = useState(false);

  const selectedModel = models.find(m => m.id === selectedModelId) || models[0];

  const handleDownloadZip = async () => {
    if (!selectedModel) return;
    setDownloading(true);
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      };
      const res = await axios.get(`${API_URL}/api/export-deployment?model_id=${selectedModel.id}`, config);
      
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `deployment_${selectedModel.id}_${selectedModel.model_name.replace(/ /g, '_')}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export deployment bundle. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (models.length === 0) {
    return (
      <Card className="p-8 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center justify-center mx-auto">
          <Server className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">No Trained Models to Deploy</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Train a model first to export standalone FastAPI and Docker containers ready for AWS ECS, Google Cloud Run, or Kubernetes.
        </p>
      </Card>
    );
  }

  const fastapiSnippet = `import joblib, pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel

bundle = joblib.load("model.pkl")
model = bundle["model"]
app = FastAPI(title="${selectedModel?.model_name || 'ML Model'} API")

class PredictRequest(BaseModel):
    inputs: dict

@app.post("/predict")
def predict(req: PredictRequest):
    df = pd.DataFrame([req.inputs])
    # Fitted preprocessing & inference automatically applied
    prediction = model.predict(df)[0]
    return {"prediction": prediction, "status": "success"}`;

  const dockerSnippet = `FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]`;

  const curlSnippet = `curl -X POST http://localhost:8000/predict \\
  -H "Content-Type: application/json" \\
  -d '{"inputs": {"feature_1": 42.0, "feature_2": 3.5}}'`;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <Card className="p-6 bg-gradient-to-r from-blue-950/30 via-slate-900 to-cyan-950/30 border-primary/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl text-cyan-400">
              <Server className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Standalone Deployment Generator</h2>
                <Badge variant="success" className="text-[9px] uppercase font-mono font-bold tracking-wider">FastAPI + Docker</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                Download a self-contained production microservice archive containing your trained <strong>{selectedModel?.model_name}</strong> bundle, FastAPI REST endpoints, Dockerfile, and requirements. Deploy to AWS ECS, GCP Cloud Run, or Render in under 5 minutes.
              </p>
            </div>
          </div>

          <Button 
            onClick={handleDownloadZip}
            loading={downloading}
            className="px-6 py-6 text-sm font-bold shadow-lg shadow-primary/20 flex items-center shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            <span>Download .ZIP Bundle</span>
          </Button>
        </div>
      </Card>

      {/* Code & Artifact Preview */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/80 pb-3 mb-4 gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveCodeTab('fastapi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                activeCodeTab === 'fastapi' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              app.py (FastAPI)
            </button>
            <button
              onClick={() => setActiveCodeTab('docker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                activeCodeTab === 'docker' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dockerfile
            </button>
            <button
              onClick={() => setActiveCodeTab('curl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
                activeCodeTab === 'curl' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              cURL Request
            </button>
          </div>

          <button
            onClick={() => {
              const text = activeCodeTab === 'fastapi' ? fastapiSnippet : activeCodeTab === 'docker' ? dockerSnippet : curlSnippet;
              copyToClipboard(text);
            }}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 border border-border px-3 py-1.5 rounded-lg transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Code Content */}
        <pre className="p-4 bg-slate-950 border border-border/80 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto custom-scrollbar">
          <code>
            {activeCodeTab === 'fastapi' && fastapiSnippet}
            {activeCodeTab === 'docker' && dockerSnippet}
            {activeCodeTab === 'curl' && curlSnippet}
          </code>
        </pre>
      </Card>

      {/* Deployment Checklist Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-slate-950/60 border border-border rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <Box className="w-4 h-4" />
            <span>1. Docker Container</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
            docker build -t ml-service .<br />
            docker run -p 8000:8000 ml-service
          </p>
        </div>

        <div className="p-4 bg-slate-950/60 border border-border rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            <span>2. Cloud Run & ECS</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Push container image to AWS ECR or Google Artifact Registry for auto-scaling serverless containers.
          </p>
        </div>

        <div className="p-4 bg-slate-950/60 border border-border rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Check className="w-4 h-4" />
            <span>3. Swagger Docs Included</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Interactive OpenAPI documentation and live testing available out-of-the-box at <code>/docs</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
