import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';

const AuthContext = createContext({
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiGet('/api/auth/me')
      .then((data) => {
        if (active) setIsAuthenticated(!!(data && data.authenticated));
      })
      .catch(() => {
        if (active) setIsAuthenticated(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    await apiPost('/api/auth/login', { username, password });
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await apiPost('/api/auth/logout', {});
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
