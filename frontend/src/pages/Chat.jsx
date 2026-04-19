import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bot, User, Send, ArrowLeft, Loader2, Database, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ChatPage() {
    const [searchParams] = useSearchParams();
    const dataset_id = searchParams.get('dataset_id');
    const navigate = useNavigate();
    const { token } = useAuth();
    
    // Dataset list (mock or loaded from an API if we had a dedicated GET /datasets route)
    // For now we assume we know the dataset_id we are discussing.
    
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Fetch prior history
    useEffect(() => {
        if (!dataset_id) return;
        
        const fetchHistory = async () => {
            try {
                const res = await axios.get(`http://localhost:8000/api/chat?dataset_id=${dataset_id}`);
                const history = [];
                res.data.forEach(exchange => {
                    history.push({ role: 'user', content: exchange.question });
                    history.push({ role: 'ai', content: exchange.answer });
                });
                setMessages(history.length > 0 ? history : [
                    { role: 'ai', content: "Hello! I am your Autonomous Data Scientist. Activating LangGraph analysis module... You can ask me questions about missing values, outliers, or anything about your dataset!"}
                ]);
            } catch (err) {
                console.error("Error fetching chat history", err);
            }
        };
        fetchHistory();
    }, [dataset_id]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !dataset_id) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await axios.post('http://localhost:8000/api/chat', {
                dataset_id,
                question: userMsg.content
            });
            setMessages(prev => [...prev, { role: 'ai', content: res.data.answer }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', content: "I encountered an error analyzing your request. Please ensure dataset exists and try again." }]);
        } finally {
            setLoading(false);
        }
    };

    if (!dataset_id) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <Database className="w-12 h-12 text-slate-500 mb-4" />
                <h2 className="text-xl font-semibold text-slate-300">No Dataset Selected</h2>
                <button 
                  onClick={() => navigate('/')} 
                  className="mt-6 flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Upload Dataset First
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto h-[80vh] flex flex-col glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            {/* Header */}
            <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <button onClick={() => navigate(`/dashboard?dataset_id=${dataset_id}`)} className="p-2 text-slate-400 hover:text-white transition">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                         <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">AI Data Scientist (LangGraph RAG)</h2>
                        <p className="text-xs text-emerald-400 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                            Agent Online
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-900/30">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex space-x-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                            
                            <div className="flex-shrink-0 mt-1">
                                {msg.role === 'user' ? (
                                    <div className="w-8 h-8 rounded-full bg-secondary/80 flex items-center justify-center">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                )}
                            </div>

                            <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-secondary text-white rounded-tr-sm' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'}`}>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            </div>
                        </div>
                    </div>
                ))}
                
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex space-x-3 max-w-[80%]">
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm flex items-center space-x-2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm text-slate-400">Agent thinking... accessing LangGraph tools...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-800">
                <form onSubmit={handleSend} className="relative flex items-center">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about missing values, outliers, or to run a model summary..."
                        className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl pl-4 pr-12 py-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition shadow-inner"
                        disabled={loading}
                    />
                    <button 
                        type="submit" 
                        disabled={loading || !input.trim()}
                        className="absolute right-2 p-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
                <div className="mt-3 flex justify-center space-x-2 text-xs text-slate-500">
                    <span className="cursor-pointer hover:text-slate-300" onClick={() => setInput("What columns have missing values?")}>"What columns have missing values?"</span>
                    <span>•</span>
                    <span className="cursor-pointer hover:text-slate-300" onClick={() => setInput("Are there any outliers?")}>"Are there any outliers?"</span>
                </div>
            </div>

        </div>
    );
}
