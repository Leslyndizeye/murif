// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext({});

// FastAPI sends validation errors (HTTP 422) as an array of objects under
// `detail`, and everything else as a plain string. Collapse it to a single
// string so it can be rendered directly in JSX without crashing React.
const messageFromError = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d?.msg || String(d)).join(', ') || fallback;
  }
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  return fallback;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        authAPI.getCurrentUser()
          .then(response => {
            if (response) {
              setUser(response);
              localStorage.setItem('user', JSON.stringify(response));
            }
          })
          .catch(err => {
            // Only a real 401 means the stored token is genuinely invalid or
            // expired -> sign out. Anything else (backend down, 5xx, timeout,
            // CORS) is transient; keep the cached session so a blip on refresh
            // doesn't dump the user on the login page.
            if (err?.response?.status === 401) {
              logout();
            }
          })
          .finally(() => {
            setLoading(false);
          });
      } catch (err) {
        // Stored user JSON is corrupted -> clear the broken session instead of
        // leaving the app in a half-logged-in state.
        authAPI.logout();
        setUser(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login({ email, password });
      
      // Store user data
      const userData = response.user || response;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      return { success: true, data: response };
    } catch (err) {
      const errorMsg = messageFromError(err, 'Login failed');
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.register(userData);
      return { success: true, data: response };
    } catch (err) {
      const errorMsg = messageFromError(err, 'Registration failed');
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
    setError(null);
  };

  const hasAccess = (requiredRoles) => {
    if (!user) return false;
    if (requiredRoles.includes('*')) return true;
    const userRole = (user.role || '').toLowerCase();
    return requiredRoles.includes(userRole);
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    hasAccess,
    userRole: user?.role || null
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};