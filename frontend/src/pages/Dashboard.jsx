import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import FileUpload from '../components/FileUpload';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { 
  Database, Activity, FolderOpen, Search, Filter, 
  Trash2, Copy, Download, ExternalLink, HelpCircle, 
  Sparkles, Layers, HardDrive, Cpu, ArrowRight, RefreshCw,
  LogOut, MessageSquare
} from 'lucide-react';

export default function Dashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, recent, large
  
  // Modals / actions state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [datasetsRes, modelsRes] = await Promise.all([
        axios.get(`${API_URL}/api/datasets`, config),
        axios.get(`${API_URL}/api/models`, config)
      ]);
      setDatasets(datasetsRes.data.results || []);
      setModels(modelsRes.data.results || []);
    } catch (err) {
      setError("Failed to load dashboard data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchDashboardData();
  }, [token]);

  // Actions
  const handleUploadSuccess = (data) => {
    // Refresh datasets list
    fetchDashboardData();
  };

  const handleUploadError = (err) => {
    setError(err);
  };

  const handleDeleteClick = (e, ds) => {
    e.stopPropagation();
    setSelectedDataset(ds);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedDataset) return;
    setActionLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_URL}/api/datasets/${selectedDataset.id}`, config);
      setDeleteModalOpen(false);
      setSelectedDataset(null);
      fetchDashboardData();
    } catch (err) {
      alert("Failed to delete dataset.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (e, ds) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(`${API_URL}/api/datasets/${ds.id}`, { action: 'duplicate' }, config);
      fetchDashboardData();
    } catch (err) {
      alert("Failed to duplicate dataset.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadDataset = (e, ds) => {
    e.stopPropagation();
    // Raw download url
    window.open(ds.file_url, '_blank');
  };

  const navigateToWorkspace = (datasetId, tab = 'overview') => {
    navigate(`/workspace?dataset_id=${datasetId}&tab=${tab}`);
  };

  // Search & Filtering logic
  const filteredDatasets = datasets.filter(ds => {
    const matchesSearch = ds.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterType === 'recent') {
      const uploadDate = new Date(ds.uploaded_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return uploadDate >= sevenDaysAgo;
    }
    
    if (filterType === 'large') {
      // Columns check as proxy for size
      return (ds.metadata?.columns?.length || 0) > 10;
    }
    
    return true;
  });

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  // Stats calculation
  const totalRowsCount = datasets.reduce((sum, ds) => sum + (ds.metadata?.eda_report?.overview?.total_rows || 0), 0);
  const totalStorageMock = (datasets.length * 1.4).toFixed(1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      {/* Navbar Minimal Dashboard Header */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center border border-white/10 shadow-lg shadow-primary/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Hilton AI</h2>
            <p className="text-xs text-slate-500">Autonomous Data Science Engine</p>
          </div>
        </div>
        
        {/* Profile / Logout Menu */}
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-200">{user?.full_name || 'Data Scientist'}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 border border-border bg-slate-950 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition flex items-center justify-center"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card/80 to-slate-950/20 p-8 md:p-10 shadow-premium">
        <div className="absolute top-0 right-0 w-[40%] h-[100%] bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-2xl space-y-4 relative z-10">
          <Badge variant="info" className="px-3 py-1 font-semibold uppercase tracking-wider text-[10px]">
            Platform Console v1.0
          </Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Analyze, train, and deploy models <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent">autonomously</span>.
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Upload any tabular CSV file. Our server executes automatic preprocessing, target estimation, correlation heatmaps, model comparisons, and hosts a specialized LLM agent to query results.
          </p>
        </div>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          label="Uploaded Datasets" 
          value={datasets.length} 
          icon={Database} 
          description="Total active csv workspaces" 
        />
        <StatCard 
          label="Trained Models" 
          value={models.length} 
          icon={Cpu} 
          description="Ready machine learning runs" 
        />
        <StatCard 
          label="Database Storage" 
          value={`${totalStorageMock} MB`} 
          icon={HardDrive} 
          description="Using 1.4MB per dataset avg" 
        />
        <StatCard 
          label="Total Records" 
          value={totalRowsCount.toLocaleString()} 
          icon={Layers} 
          description="Rows ingested by statistical engine" 
        />
      </div>

      {/* Upload and Dataset Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Quick Upload */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6">
            <CardHeader className="mb-4">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-bold">Upload New Dataset</CardTitle>
              </div>
            </CardHeader>
            <FileUpload 
              onUploadSuccess={handleUploadSuccess} 
              onUploadError={handleUploadError} 
            />
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-400 rounded-xl leading-relaxed">
                {error}
              </div>
            )}
          </Card>

          {/* Quick Chat Shortcut Card */}
          {datasets.length > 0 && (
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <CardHeader className="mb-2">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5 text-primary animate-pulse" />
                  <CardTitle className="text-base font-bold">Ask AI Scientist</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 mb-4">
                Chat with your active datasets using a natural language interface.
              </CardContent>
              <Button 
                onClick={() => navigateToWorkspace(datasets[0].id, 'chat')} 
                size="sm" 
                className="w-full flex items-center justify-center"
              >
                Open Latest Chat <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>
          )}
        </div>

        {/* Right Column: Datasets List */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search datasets by name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-border rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition"
              />
            </div>
            
            {/* Filter buttons */}
            <div className="flex items-center space-x-1.5 self-end sm:self-auto">
              <button 
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  filterType === 'all' 
                    ? 'border-primary/30 bg-primary/10 text-white' 
                    : 'border-border bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setFilterType('recent')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  filterType === 'recent' 
                    ? 'border-primary/30 bg-primary/10 text-white' 
                    : 'border-border bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Recent
              </button>
              <button 
                onClick={() => setFilterType('large')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  filterType === 'large' 
                    ? 'border-primary/30 bg-primary/10 text-white' 
                    : 'border-border bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                Complex (Cols &gt; 10)
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-28 w-full bg-card animate-pulse rounded-2xl border border-border" />
              ))}
            </div>
          ) : filteredDatasets.length === 0 ? (
            <EmptyState 
              icon={Database}
              title="No datasets found"
              description={searchTerm ? "Try searching for a different keyword or adjusting filters." : "Upload your first CSV dataset in the left pane to initialize exploratory statistics."}
              actionText={searchTerm ? "Clear Search Filters" : null}
              onAction={searchTerm ? () => { setSearchTerm(''); setFilterType('all'); } : null}
              className="py-16"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredDatasets.map((ds) => {
                const rowCount = ds.metadata?.eda_report?.overview?.total_rows || 0;
                const colCount = ds.metadata?.columns?.length || 0;
                
                return (
                  <div
                    key={ds.id}
                    onClick={() => navigateToWorkspace(ds.id)}
                    className="group border border-border bg-card hover:border-slate-700 rounded-2xl p-5 hover:shadow-subtle-glow transition-all duration-300 cursor-pointer flex flex-col justify-between relative"
                  >
                    <div className="space-y-3">
                      {/* Card Title & Icon */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="p-2.5 bg-slate-900 border border-border text-primary rounded-xl shrink-0">
                            <Database className="w-5 h-5" />
                          </div>
                          <div className="overflow-hidden">
                            <h3 className="font-bold text-white text-sm truncate group-hover:text-primary transition-colors pr-2" title={ds.name}>
                              {ds.name}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">Uploaded {formatDate(ds.uploaded_at)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Info stats details */}
                      <div className="grid grid-cols-2 gap-3 py-1 bg-slate-950/40 rounded-xl border border-border/40 p-2.5 text-center">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Rows</p>
                          <p className="text-sm font-bold text-slate-200 mt-0.5">
                            {rowCount > 0 ? rowCount.toLocaleString() : 'Loading...'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Columns</p>
                          <p className="text-sm font-bold text-slate-200 mt-0.5">{colCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions and status */}
                    <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-xs">
                      <Badge variant={rowCount > 0 ? "success" : "warning"} className="text-[9px] uppercase tracking-wider font-semibold">
                        {rowCount > 0 ? "ready" : "analyzing"}
                      </Badge>

                      <div className="flex items-center space-x-1 relative z-25">
                        <button
                          onClick={(e) => handleDuplicate(e, ds)}
                          title="Duplicate Dataset"
                          className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition"
                          disabled={actionLoading}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDownloadDataset(e, ds)}
                          title="Download Raw File"
                          className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, ds)}
                          title="Delete Dataset"
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                          disabled={actionLoading}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal 
        isOpen={deleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)} 
        title="Delete Dataset"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to delete <span className="font-semibold text-white">"{selectedDataset?.name}"</span>? 
            This will permanently remove the dataset and all associated trained machine learning models from the server.
          </p>
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Button 
              variant="secondary" 
              onClick={() => setDeleteModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="danger" 
              onClick={confirmDelete}
              loading={actionLoading}
            >
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
