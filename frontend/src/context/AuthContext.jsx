import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('access_token'));
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const navigate = useNavigate();

    // ── Axios interceptors ─────────────────────────────────────────────────
    useEffect(() => {
        const reqInterceptor = axios.interceptors.request.use((config) => {
            const t = localStorage.getItem('access_token');
            if (t) {
                config.headers['Authorization'] = `Bearer ${t}`;
            }
            return config;
        });

        const resInterceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                    delete axios.defaults.headers.common['Authorization'];
                    navigate('/login');
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.request.eject(reqInterceptor);
            axios.interceptors.response.eject(resInterceptor);
        };
    }, [navigate]);

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    const login = async (email, password) => {
        try {
            const res = await axios.post(`${API_URL}/api/login`, { email, password });
            const accessToken = res.data.access;
            localStorage.setItem('access_token', accessToken);
            
            const userData = {
                id: res.data.user?.id,
                email: res.data.user?.email || email,
                full_name: res.data.user?.full_name || '',
            };
            localStorage.setItem('user', JSON.stringify(userData));
            
            setToken(accessToken);
            setUser(userData);
            navigate('/');
            return { success: true };
        } catch (error) {
            const detail = error.response?.data?.detail || 'Invalid email or password';
            return { success: false, error: detail };
        }
    };

    const register = async (full_name, email, password, confirm_password) => {
        try {
            await axios.post(`${API_URL}/api/register`, { 
                full_name, 
                email, 
                password, 
                confirm_password 
            });
            return await login(email, password);
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'Registration failed. Please check your credentials.' 
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
