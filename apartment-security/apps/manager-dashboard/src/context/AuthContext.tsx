import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/api';

type ManagerProfile = {
  name: string;
  propertyName: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  managerProfile: ManagerProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateFromMe = async () => {
    const response = await api.get('/auth/me');
    const { data } = response.data;
    if (data.role !== 'MANAGER' || !data.manager) {
      throw new Error('This account is not registered as a property manager.');
    }
    setIsAuthenticated(true);
    setManagerProfile({
      name: data.manager.name,
      propertyName: data.manager.property?.name ?? '',
    });
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('managerToken');
      if (token) {
        try {
          await hydrateFromMe();
        } catch {
          localStorage.removeItem('managerToken');
        }
      }
      setIsLoading(false);
    };
    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { data } = response.data;
    localStorage.setItem('managerToken', data.accessToken);
    try {
      await hydrateFromMe();
    } catch (error) {
      localStorage.removeItem('managerToken');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('managerToken');
    setIsAuthenticated(false);
    setManagerProfile(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, managerProfile, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
