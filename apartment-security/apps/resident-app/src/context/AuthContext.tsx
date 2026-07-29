import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';
import tokenStorage from '../utils/tokenStorage';

type Role = 'RESIDENT' | 'GUARD' | 'MANAGER' | null;

type UserProfile = {
  name: string;
  phone: string;
  wing: string;
  flat: string;
  propertyName: string;
  photoUri: string | null;
};

type AuthContextType = {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  userId: string | null;
  userPhone: string | null;
  userEmail: string | null;
  userRole: Role;
  isOnboarded: boolean;
  userProfile: UserProfile | null;
  updateProfile: (profile: UserProfile) => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrates auth state from GET /auth/me — the single source of truth for
  // role/resident/onboarding status, used both on app launch and right after login.
  const hydrateFromMe = async () => {
    const response = await api.get('/auth/me');
    const { data } = response.data; // sendSuccess wraps payload in { data }
    setIsAuthenticated(true);
    setUserId(data.id ?? null);
    setUserRole(data.role as Role);
    setUserPhone(data.phone ?? null);
    setUserEmail(data.email ?? null);
    setIsOnboarded(data.role !== 'RESIDENT' || !!data.resident);
    if (data.resident) {
      setUserProfile({
        name: data.resident.name ?? '',
        phone: data.phone ?? '',
        wing: data.resident.unit?.tower ?? '',
        flat: data.resident.unit?.unitNumber ?? '',
        propertyName: data.resident.unit?.property?.name ?? '',
        photoUri: null,
      });
    } else {
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await tokenStorage.getItemAsync('userToken');
        if (token) {
          await hydrateFromMe();
        }
      } catch {
        await tokenStorage.deleteItemAsync('userToken').catch(() => {});
      }
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { data } = response.data;
      await tokenStorage.setItemAsync('userToken', data.accessToken);
      await tokenStorage.setItemAsync('refreshToken', data.refreshToken);
      await hydrateFromMe();
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      await api.post('/auth/signup', { email, password, role: 'RESIDENT' });
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    setIsOnboarded(true);
  };

  const logout = async () => {
    try {
      const refreshToken = await tokenStorage.getItemAsync('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
      await tokenStorage.deleteItemAsync('userToken');
      await tokenStorage.deleteItemAsync('refreshToken');
    } catch {
      // Silently ignore — local state is still cleared
    }
    setIsAuthenticated(false);
    setUserId(null);
    setUserPhone(null);
    setUserEmail(null);
    setUserRole(null);
    setIsOnboarded(false);
    setUserProfile(null);
  };

  // Revokes every refresh token issued to this account (all devices), then
  // clears local session state the same way a normal logout does.
  const logoutAllDevices = async () => {
    try {
      await api.post('/auth/logout-all');
    } catch {
      // Still proceed to clear the local session even if the request failed.
    }
    await logout();
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated, login, signup, logout, logoutAllDevices,
      userId, userPhone, userEmail, userRole, isOnboarded, userProfile, updateProfile, isLoading
    }}>
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
