import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import { Bot, User, Send, Loader2, MessageSquare, X, Maximize, Minimize } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FloatingChat({ dataset_id }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const messagesEndRef = useRef(null);
    const { token } = useAuth(); // If needed for auth headers

    // Fetch prior history only when opened and not loaded yet
    useEffect(() => {
        if (!isOpen || !dataset_id || historyLoaded) return;
        
        const fetchHistory = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/chat?dataset_id=${dataset_id}`);
                const history = [];
                res.data.forEach(exchange => {
                    history.push({ role: 'user', content: exchange.question });
                    history.push({ role: 'ai', content: exchange.answer });
                });
                setMessages(history.length > 0 ? history : [
                    { role: 'ai', content: "Hello! I am your AI Data Scientist. You can ask me questions about this dataset, missing values, outliers, or anything else!"}
                ]);
                setHistoryLoaded(true);
            } catch (err) {
                console.error("Error fetching chat history", err);
            }
        };
        fetchHistory();
    }, [isOpen, dataset_id, historyLoaded]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !dataset_id) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await axios.post(`${API_URL}/api/chat`, {
                dataset_id,
                question: userMsg.content
            });
            setMessages(prev => [...prev, { role: 'ai', content: res.data.answer }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', content: "I encountered an error analyzing your request. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    if (!dataset_id) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className={`flex flex-col glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700 animate-in fade-in duration-300 ${
                    isFullscreen 
                        ? "fixed top-6 left-6 right-6 bottom-6 z-[110] w-[calc(100vw-48px)] h-[calc(100vh-48px)]" 
                        : "mb-4 w-[380px] max-w-[calc(100vw-32px)] h-[550px] max-h-[calc(100vh-120px)]"
                }`}>
                    {/* Header */}
                    <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                                <MessageSquare className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-md font-bold text-white leading-tight">AI Data Scientist</h2>
                                <p className="text-[10px] text-emerald-400 flex items-center mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                    Agent Online
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={() => setIsFullscreen(!isFullscreen)} 
                                title={isFullscreen ? "Minimize" : "Maximize"}
                                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                            >
                                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)} 
                                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/40">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex space-x-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                                    <div className="flex-shrink-0 mt-1">
                                        {msg.role === 'user' ? (
                                            <div className="w-7 h-7 rounded-full bg-secondary/80 flex items-center justify-center shadow-lg">
                                                <User className="w-3.5 h-3.5 text-white" />
                                            </div>
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                                                <Bot className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </div>

                                    <div className={`p-3 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-secondary text-white rounded-tr-sm' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'}`}>
                                        <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {loading && (
                            <div className="flex justify-start">
                                <div className="flex space-x-2 max-w-[85%]">
                                    <div className="flex-shrink-0 mt-1">
                                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                                            <Bot className="w-4 h-4 text-white" />
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm flex items-center space-x-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                        <span className="text-[13px] text-slate-400">Agent thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-slate-900/90 backdrop-blur-md border-t border-slate-800">
                        <form onSubmit={handleSend} className="relative flex items-center">
                            <input 
                                type="text" 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask a question..."
                                className="w-full bg-slate-800/80 border border-slate-700 text-[13px] text-white rounded-xl pl-3 pr-10 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition shadow-inner"
                                disabled={loading}
                            />
                            <button 
                                type="submit" 
                                disabled={loading || !input.trim()}
                                className="absolute right-1.5 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-r from-primary to-secondary rounded-full shadow-[0_0_20px_rgba(var(--primary),0.4)] hover:shadow-[0_0_30px_rgba(var(--primary),0.6)] hover:scale-110 transition-all duration-300"
                >
                    <MessageSquare className="w-6 h-6 text-white" />
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
                    </span>
                </button>
            )}
        </div>
    );
}
