import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { authEvents } from '../utils/api';

type Role = 'RESIDENT' | 'GUARD' | 'MANAGER' | 'COMMITTEE' | null;

type UserProfile = {
  name: string;
  phone: string;
  wing: string;
  flat: string;
  photoUri: string | null;
};

type AuthContextType = {
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  userPhone: string | null;
  userEmail: string | null;
  userRole: Role;
  isOnboarded: boolean;
  userProfile: UserProfile | null;
  updateProfile: (profile: UserProfile) => void;
  isLoading: boolean;
  userId: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authEvents.subscribe(() => {
      logout();
    });
    loadUser();
    return () => unsubscribe();
  }, []);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        const res = await api.get('/auth/me');
        const data = res.data.data;
        setUserPhone(data.phone);
        setUserRole(data.role);
        setUserId(data.id);
        
        if (data.resident) {
          setUserProfile({
            name: data.resident.name || 'Resident',
            phone: data.phone,
            wing: data.resident.unit?.property?.name || 'Block',
            flat: data.resident.unit?.unitNumber || 'N/A',
            photoUri: data.resident.photoUrl || null,
          });
          setIsOnboarded(true);
        }
        setIsAuthenticated(true);
      }
    } catch (e: any) {
      console.log('Failed to load user', e);
      // Only force logout on explicit 401s, not on network timeouts or 500s.
      if (e.response && e.response.status === 401) {
        await SecureStore.deleteItemAsync('userToken');
        await SecureStore.deleteItemAsync('refreshToken');
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync('userToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await loadUser();
  };
  
  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setIsAuthenticated(false);
    setUserProfile(null);
    setUserRole(null);
    setUserId(null);
  };

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated, login, logout,
      userPhone, userEmail, userRole, isOnboarded, userProfile, updateProfile, isLoading, userId
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
