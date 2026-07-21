import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Workspace = lazy(() => import('./pages/Workspace'));
const AuthPage = lazy(() => import('./pages/Auth'));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-xs text-slate-500 animate-pulse font-medium">Loading panel component...</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function MainApp() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex flex-col">
      {/* Subtle ambient gradients */}
      <div className="absolute top-[-15%] left-[-15%] w-[45%] h-[45%] rounded-full bg-primary/5 blur-[140px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[45%] h-[45%] rounded-full bg-secondary/5 blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <main className="relative z-10 flex-grow mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 w-full flex flex-col justify-start">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<AuthPage isLogin={true} />} />
            <Route path="/register" element={<AuthPage isLogin={false} />} />
            
            {/* Main Hub Dashboard */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* Dataset Workspace Hub */}
            <Route path="/workspace" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
            
            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
