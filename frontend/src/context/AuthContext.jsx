import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('access_token'));
    const navigate = useNavigate();

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Optional: verify token validity or fetch user details here
            setUser({ token }); 
        } else {
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
        }
    }, [token]);

    const login = async (username, password) => {
        try {
            const res = await axios.post('http://localhost:8000/api/login', { username, password });
            const accessToken = res.data.access;
            localStorage.setItem('access_token', accessToken);
            setToken(accessToken);
            navigate('/');
            return { success: true };
        } catch (error) {
            return { success: false, error: 'Invalid credentials' };
        }
    };

    const register = async (username, password) => {
        try {
            await axios.post('http://localhost:8000/api/register', { username, password });
            return await login(username, password);
        } catch (error) {
            return { success: false, error: error.response?.data?.error || 'Registration failed' };
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        setToken(null);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, token }}>
            {children}
        </AuthContext.Provider>
    );
};
