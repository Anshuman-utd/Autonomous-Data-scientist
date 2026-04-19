import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UploadPage from './pages/Upload';
import Dashboard from './pages/Dashboard';
import ModelTraining from './pages/ModelTraining';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen relative overflow-hidden bg-background">
        {/* Background gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[120px] pointer-events-none" />
        
        {/* Standard App Container */}
        <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-16">
          <header className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent inline-block pb-2">
              Autonomous Data Scientist
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-400 mx-auto">
              Upload your dataset to start automatic exploratory data analysis and generate intelligent insights.
            </p>
          </header>

          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/train" element={<ModelTraining />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
