import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, ArrowLeft, AlertCircle } from 'lucide-react';
import OverviewCards from '../components/OverviewCards';
import MissingValuesChart from '../components/MissingValuesChart';
import CorrelationHeatmap from '../components/CorrelationHeatmap';
import DistributionCharts from '../components/DistributionCharts';
import OutliersSection from '../components/OutliersSection';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const dataset_id = searchParams.get('dataset_id');
  const filename = searchParams.get('filename'); // Fallback purely for display if no DB yet
  const navigate = useNavigate();

  const [edaData, setEdaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dataset_id && !filename) {
      setError("No dataset specified. Please go back and upload a dataset.");
      setLoading(false);
      return;
    }

    const fetchEda = async () => {
      try {
        const urlParams = dataset_id ? `dataset_id=${dataset_id}` : `filename=${filename}`;
        const response = await axios.get(`http://localhost:8000/api/eda?${urlParams}`);
        setEdaData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load EDA data.");
      } finally {
        setLoading(false);
      }
    };

    fetchEda();
  }, [dataset_id, filename]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Activity className="w-12 h-12 text-secondary animate-pulse mb-4" />
        <h2 className="text-xl font-semibold text-slate-200">Analyzing Dataset...</h2>
        <p className="text-slate-400 mt-2">Running statistical models and EDA pipeline</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-red-200">{error}</h2>
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
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Dataset Insights</h2>
          <p className="text-slate-400">Automated EDA report for <span className="text-slate-200 font-medium">{filename}</span></p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="flex items-center px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Upload New
        </button>
      </div>

      <OverviewCards overview={edaData.overview} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MissingValuesChart missing={edaData.missing_values} />
        <CorrelationHeatmap correlation={edaData.correlation} />
      </div>

      <DistributionCharts distributions={edaData.distributions} />
      
      <OutliersSection outliers={edaData.outliers} />

      {/* Phase 3: Proceed to Model Training CTA */}
      <div className="mt-12 flex justify-center space-x-4">
        <button
          onClick={() => navigate(`/train?dataset_id=${dataset_id}`)}
          className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-gradient-to-r from-primary to-secondary font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary hover:scale-105 shadow-lg shadow-primary/30"
        >
          <Activity className="w-5 h-5 mr-3 group-hover:animate-pulse" />
          Proceed to Model Training
        </button>

        <button
          onClick={() => navigate(`/chat?dataset_id=${dataset_id}`)}
          className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-slate-200 transition-all duration-200 bg-slate-800 border border-slate-700 font-pj rounded-xl hover:bg-slate-700 focus:ring-2 focus:ring-slate-600 shadow-lg"
        >
          Chat with Dataset (AI)
        </button>
      </div>

    </div>
  );
}
