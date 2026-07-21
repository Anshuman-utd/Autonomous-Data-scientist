import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AuthPage({ isLogin }) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Client side checks
        if (!email.includes('@')) {
            setError("Please enter a valid email address.");
            return;
        }

        if (!isLogin) {
            if (!fullName.trim()) {
                setError("Full Name is required.");
                return;
            }
            if (password.length < 6) {
                setError("Password must be at least 6 characters.");
                return;
            }
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
        }

        setLoading(true);

        const result = isLogin 
            ? await login(email, password)
            : await register(fullName, email, password, confirmPassword);
            
        if (!result.success) {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[75vh] px-4">
            {/* Ambient Background Glow */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full bg-primary/10 blur-[100px] pointer-events-none animate-pulse-slow" />
            
            <div className="w-full max-w-md relative z-10">
                {/* Branding Logo */}
                <div className="flex flex-col items-center mb-8">
                    <h1 className="text-2xl font-bold text-white tracking-tight">Hilton AI</h1>
                    <p className="text-sm text-slate-400 mt-1">Autonomous Data Science Engine</p>
                </div>

                <div className="glass-panel p-8 md:p-10 border border-border bg-card/65 backdrop-blur-xl shadow-2xl">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white">
                            {isLogin ? 'Welcome back' : 'Create an account'}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {isLogin ? 'Enter your credentials to access your workspace' : 'Start automated EDA and model training in seconds'}
                        </p>
                    </div>
                    
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 leading-relaxed animate-in fade-in duration-300">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400" htmlFor="fullName">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input 
                                        id="fullName"
                                        type="text" 
                                        placeholder="John Doe" 
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-slate-950 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-all duration-200"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400" htmlFor="email">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    id="email"
                                    type="email" 
                                    placeholder="name@company.com" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-all duration-200"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-slate-400" htmlFor="password">Password</label>
                                {isLogin && (
                                    <button 
                                        type="button" 
                                        onClick={() => alert("Password recovery is not configured. Please register a new user.")}
                                        className="text-xs text-primary hover:text-primary-hover font-medium transition"
                                    >
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    id="password"
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="••••••••" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950 border border-border rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-all duration-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {!isLogin && (
                            <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                <label className="text-xs font-semibold text-slate-400" htmlFor="confirmPassword">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input 
                                        id="confirmPassword"
                                        type={showPassword ? "text" : "password"} 
                                        placeholder="••••••••" 
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-slate-950 border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-all duration-200"
                                    />
                                </div>
                            </div>
                        )}

                        {isLogin && (
                            <div className="flex items-center space-x-2 pt-1">
                                <input 
                                    id="rememberMe"
                                    type="checkbox" 
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-border bg-slate-950 text-primary focus:ring-primary focus:ring-offset-background"
                                />
                                <label htmlFor="rememberMe" className="text-xs font-medium text-slate-400 select-none cursor-pointer">
                                    Remember me
                                </label>
                            </div>
                        )}
                        
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full mt-2 bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-xl transition duration-200 flex justify-center items-center text-sm shadow-lg shadow-primary/10 hover:shadow-primary/20"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-white mr-2" />
                            ) : (
                                <>
                                    {isLogin ? 'Log In' : 'Sign Up'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Social Authentication Placeholder */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-3 text-slate-500">Or continue with</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            type="button"
                            disabled
                            className="flex items-center justify-center px-4 py-2.5 border border-border rounded-xl text-slate-500 bg-slate-950/20 cursor-not-allowed text-xs font-medium"
                            title="Single Sign-On disabled in demo mode"
                        >
                            Google
                        </button>
                        <button 
                            type="button"
                            disabled
                            className="flex items-center justify-center px-4 py-2.5 border border-border rounded-xl text-slate-500 bg-slate-950/20 cursor-not-allowed text-xs font-medium"
                            title="SSO disabled in demo mode"
                        >
                            GitHub
                        </button>
                    </div>

                    <div className="text-center mt-6">
                        <Link 
                            to={isLogin ? '/register' : '/login'} 
                            className="text-xs text-slate-400 hover:text-white font-medium transition"
                        >
                            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
