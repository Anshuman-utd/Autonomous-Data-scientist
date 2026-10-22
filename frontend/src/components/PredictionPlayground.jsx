import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import { 
  Cpu, Sliders, Play, RefreshCw, Dices, Sparkles, 
  CheckCircle, AlertCircle, TrendingUp, Info, HelpCircle
} from 'lucide-react';

export default function PredictionPlayground({ dataset, models = [] }) {
  const { token } = useAuth();
  
  // Model selection
  const [selectedModelId, setSelectedModelId] = useState(models[0]?.id || null);
  const [schemaData, setSchemaData] = useState(null);
  const [inputs, setInputs] = useState({});
  const [loadingSchema, setLoadingSchema] = useState(false);
  
  // Prediction execution state
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [error, setError] = useState(null);

  // Update selected model if initial models change
  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId]);

  // Fetch model schema & feature specs whenever selectedModelId changes
  useEffect(() => {
    if (!selectedModelId) return;

    const fetchSchema = async () => {
      setLoadingSchema(true);
      setError(null);
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(`${API_URL}/api/model-schema?model_id=${selectedModelId}`, config);
        setSchemaData(res.data);

        // Initialize inputs with schema defaults
        const initialInputs = {};
        (res.data.schema_info || []).forEach((feat) => {
          initialInputs[feat.name] = feat.default ?? (feat.type === 'numeric' ? 0 : '');
        });
        setInputs(initialInputs);

        // Auto-run first prediction on mount for instant gratification
        runPrediction(selectedModelId, initialInputs);
      } catch (err) {
        setError("Failed to load predictor schema for selected model.");
      } finally {
        setLoadingSchema(false);
      }
    };

    fetchSchema();
  }, [selectedModelId, token]);

  const handleInputChange = (fieldName, value) => {
    setInputs(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleResetDefaults = () => {
    if (!schemaData) return;
    const initialInputs = {};
    (schemaData.schema_info || []).forEach((feat) => {
      initialInputs[feat.name] = feat.default ?? (feat.type === 'numeric' ? 0 : '');
    });
    setInputs(initialInputs);
    runPrediction(selectedModelId, initialInputs);
  };

  const handleRandomSample = () => {
    const preview = dataset?.metadata?.preview || [];
    if (preview.length === 0) return;
    const randomRow = preview[Math.floor(Math.random() * preview.length)];
    const sampledInputs = {};
    (schemaData?.schema_info || []).forEach((feat) => {
      if (randomRow[feat.name] !== undefined && randomRow[feat.name] !== null) {
        sampledInputs[feat.name] = randomRow[feat.name];
      } else {
        sampledInputs[feat.name] = feat.default ?? (feat.type === 'numeric' ? 0 : '');
      }
    });
    setInputs(sampledInputs);
    runPrediction(selectedModelId, sampledInputs);
  };

  const runPrediction = async (modelIdToUse, inputsToUse) => {
    const mId = modelIdToUse || selectedModelId;
    const payloadInputs = inputsToUse || inputs;
    if (!mId) return;

    setPredicting(true);
    setError(null);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${API_URL}/api/predict`, {
        model_id: mId,
        inputs: payloadInputs
      }, config);
      setPredictionResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Inference error occurred. Check input ranges.");
    } finally {
      setPredicting(false);
    }
  };

  if (models.length === 0) {
    return (
      <Card className="p-8 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center justify-center mx-auto">
          <Cpu className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">No Trained Models Available</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The Live "What-If" Simulator requires a trained model. Head over to the <strong>Model Training</strong> tab to train algorithms on this dataset.
        </p>
      </Card>
    );
  }

  if (loadingSchema) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="p-6 bg-gradient-to-r from-slate-900/90 to-card border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <Sliders className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Interactive "What-If" Prediction Playground</h2>
                <Badge variant="default" className="text-[10px] uppercase font-mono tracking-wider">Live Simulator</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjust feature values below and run real-time inference without writing code.
              </p>
            </div>
          </div>

          {/* Model Selector if multiple models exist */}
          {models.length > 1 && (
            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-400">Active Model:</label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(Number(e.target.value))}
                className="bg-slate-950 border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.model_name} ({m.accuracy?.toFixed(3)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center space-x-3 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Feature Controls (Left) vs Real-Time Output (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Dynamic Feature Controls */}
        <div className="lg:col-span-7">
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-5">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-white">Feature Input Parameters</h3>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button onClick={handleResetDefaults} variant="secondary" className="text-xs py-1 px-2.5">
                  <RefreshCw className="w-3 h-3 mr-1" /> Reset
                </Button>
                <Button onClick={handleRandomSample} variant="secondary" className="text-xs py-1 px-2.5">
                  <Dices className="w-3 h-3 mr-1" /> Random Sample
                </Button>
              </div>
            </div>

            {/* Inputs List */}
            <div className="space-y-4 max-h-[550px] overflow-y-auto custom-scrollbar pr-2">
              {schemaData?.schema_info && schemaData.schema_info.map((feat) => {
                const currentVal = inputs[feat.name] ?? '';

                if (feat.type === 'numeric') {
                  return (
                    <div key={feat.name} className="p-3 bg-slate-950/60 border border-border/60 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 font-mono">
                          {feat.name}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step={feat.step || 0.1}
                            value={currentVal}
                            onChange={(e) => handleInputChange(feat.name, e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-24 bg-slate-900 border border-border rounded-lg px-2.5 py-1 text-right text-xs font-mono text-cyan-400 focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Interactive Slider */}
                      <div className="flex items-center space-x-3">
                        <span className="text-[10px] text-slate-500 font-mono">{feat.min}</span>
                        <input
                          type="range"
                          min={feat.min}
                          max={feat.max}
                          step={feat.step || 0.1}
                          value={currentVal !== '' ? currentVal : feat.min}
                          onChange={(e) => handleInputChange(feat.name, Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">{feat.max}</span>
                      </div>
                    </div>
                  );
                } else {
                  // Categorical select
                  return (
                    <div key={feat.name} className="p-3 bg-slate-950/60 border border-border/60 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 font-mono">
                          {feat.name}
                        </label>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">categorical</span>
                      </div>

                      <select
                        value={currentVal}
                        onChange={(e) => handleInputChange(feat.name, e.target.value)}
                        className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                      >
                        {(feat.options || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
              })}
            </div>

            {/* Run Button */}
            <div className="pt-5 mt-4 border-t border-border/80">
              <Button 
                onClick={() => runPrediction()}
                loading={predicting}
                className="w-full py-5 text-sm font-bold flex items-center justify-center space-x-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Run Instant Prediction</span>
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Output Display */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 bg-gradient-to-br from-card via-slate-900 to-slate-950 border-primary/30 relative overflow-hidden shadow-2xl">
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <Badge variant="default" className="text-[10px] uppercase font-mono tracking-widest text-primary">
                Inference Output
              </Badge>
              <span className="text-[11px] text-slate-400 font-mono">{schemaData?.model_name}</span>
            </div>

            {predictionResult ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Result Hero Banner */}
                <div className="p-5 bg-slate-950/90 border border-primary/20 rounded-2xl text-center space-y-2">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Target: {predictionResult.target_column}
                  </span>
                  <div className="text-3xl font-extrabold text-white tracking-tight font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-primary">
                    {predictionResult.prediction}
                  </div>

                  {predictionResult.confidence !== null && predictionResult.confidence !== undefined && (
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full font-mono mt-2">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Confidence: {predictionResult.confidence}%</span>
                    </div>
                  )}
                </div>

                {/* Probability Distribution Breakdown for Classifiers */}
                {predictionResult.probabilities && Object.keys(predictionResult.probabilities).length > 0 && (
                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-slate-300 block">Class Probability Distribution</label>
                    <div className="space-y-2 bg-slate-950/60 border border-border/80 p-3.5 rounded-xl">
                      {Object.entries(predictionResult.probabilities).map(([cName, pVal]) => (
                        <div key={cName} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-300">{cName}</span>
                            <span className="text-primary font-bold">{pVal}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full transition-all duration-500"
                              style={{ width: `${pVal}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Explanation / Key Driver Note */}
                {predictionResult.explanation && (
                  <div className="p-3.5 bg-blue-950/20 border border-blue-500/20 rounded-xl text-xs text-blue-200 flex items-start space-x-2.5">
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed text-[11px]">{predictionResult.explanation}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Sliders className="w-8 h-8 mx-auto opacity-40 animate-pulse" />
                <p className="text-xs font-medium">Click "Run Instant Prediction" to see results</p>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
