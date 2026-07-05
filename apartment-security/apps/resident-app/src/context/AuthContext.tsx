import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../utils/api';

type Role = 'RESIDENT' | 'GUARD' | 'MANAGER' | null;

type UserProfile = {
  name: string;
  phone: string;
  wing: string;
  flat: string;
  photoUri: string | null;
};

type AuthContextType = {
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for stored token on mount
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
          // Verify token or fetch user profile here if you have a /me endpoint
          // For now, assume token is valid and they are a RESIDENT
          setIsAuthenticated(true);
          setUserRole('RESIDENT');
          setIsOnboarded(true); // Assuming they are onboarded if they have a token
        }
      } catch (e) {
        // Restoring token failed
        console.error('Failed to restore token', e);
      }
      setIsLoading(false);
    };

    bootstrapAsync();
  }, []);

  const login = async (email: string, password?: string) => {
    if (!password) {
      alert("Password is required for secure login.");
      return;
    }
    
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });

      const { token, user } = response.data;
      
      // Store token securely
      await SecureStore.setItemAsync('userToken', token);

      let role: Role = user.role || 'RESIDENT';

      setIsAuthenticated(true);
      setUserEmail(user.email || email);
      setUserRole(role);
      // For development/mock, we assume they are onboarded. 
      // Ideally, the backend would tell us if their profile is complete.
      setIsOnboarded(role !== 'RESIDENT' || !!user.resident); 
      
      if (user.resident) {
        setUserProfile({
          name: user.resident.name,
          phone: user.phone,
          wing: user.resident.unit?.tower || '',
          flat: user.resident.unit?.unitNumber || '',
          photoUri: null,
        });
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      alert(error.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    setIsOnboarded(true);
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('userToken');
    } catch (error) {
      console.error('Failed to clear secure store:', error);
    }
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserRole(null);
    setIsOnboarded(false);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, userEmail, userRole, isOnboarded, userProfile, updateProfile, isLoading }}>
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
