import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import UploadPage from './pages/Upload';
import Dashboard from './pages/Dashboard';
import ModelTraining from './pages/ModelTraining';
import AuthPage from './pages/Auth';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function MainApp() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex flex-col">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[120px] pointer-events-none" />
      
      {/* Navbar Minimal */}
      {user && (
        <nav className="relative z-20 w-full p-4 flex justify-end">
          <button onClick={logout} className="text-sm text-slate-400 hover:text-white transition">Log out</button>
        </nav>
      )}

      {/* Standard App Container */}
      <main className="relative z-10 flex-grow mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-16 w-full">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent inline-block pb-2">
            Hilton AI - Autonomous Data Scientist
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400 mx-auto">
            Upload your dataset to start automatic exploratory data analysis and generate intelligent insights.
          </p>
        </header>

        <Routes>
          <Route path="/login" element={<AuthPage isLogin={true} />} />
          <Route path="/register" element={<AuthPage isLogin={false} />} />
          <Route path="/" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/train" element={<ProtectedRoute><ModelTraining /></ProtectedRoute>} />
        </Routes>
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
