import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';
import tokenStorage from '../utils/tokenStorage';
import { connectSocket, disconnectSocket } from '../utils/socket';

type GuardProfile = {
  name: string;
  badgeNumber: string;
  phone: string;
  isOnDuty: boolean;
  propertyName: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  guardProfile: GuardProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guardProfile, setGuardProfile] = useState<GuardProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // /auth/me is the single source of truth for role + profile — used both
  // on app launch (token already stored) and right after login.
  const hydrateFromMe = async () => {
    const response = await api.get('/auth/me');
    const { data } = response.data; // sendSuccess wraps payload in { data }
    if (data.role !== 'GUARD' || !data.guard) {
      throw new Error('This account is not registered as a guard.');
    }
    setIsAuthenticated(true);
    setGuardProfile({
      name: data.guard.name,
      badgeNumber: data.guard.badgeNumber,
      phone: data.phone ?? '',
      isOnDuty: data.guard.isOnDuty,
      propertyName: data.guard.property?.name ?? '',
    });
  };

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await tokenStorage.getItemAsync('guardToken');
        if (token) {
          await hydrateFromMe();
          connectSocket(token);
        }
      } catch {
        await tokenStorage.deleteItemAsync('guardToken').catch(() => {});
      }
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await api.post('/auth/login', { email, password });
    const { data } = response.data;
    await tokenStorage.setItemAsync('guardToken', data.accessToken);
    await tokenStorage.setItemAsync('guardRefreshToken', data.refreshToken);
    try {
      await hydrateFromMe();
      connectSocket(data.accessToken);
    } catch (error) {
      await tokenStorage.deleteItemAsync('guardToken');
      await tokenStorage.deleteItemAsync('guardRefreshToken');
      throw error;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = await tokenStorage.getItemAsync('guardRefreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      await tokenStorage.deleteItemAsync('guardToken');
      await tokenStorage.deleteItemAsync('guardRefreshToken');
      disconnectSocket();
      setIsAuthenticated(false);
      setGuardProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, guardProfile, login, logout, refreshProfile: hydrateFromMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
