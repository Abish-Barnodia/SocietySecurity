import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from './api';
import tokenStorage from './tokenStorage';

export type Role = 'RESIDENT' | 'GUARD' | 'MANAGER' | 'ADMIN' | null;

export type UserProfile = {
  name: string;
  phone: string;
  email: string | null;
  wing: string;
  flat: string;
  propertyName: string;
  residentType?: string;
  isPrimary?: boolean;
  relationship?: string;
  photoUri: string | null;
};

export type GuardProfile = {
  name: string;
  badgeNumber: string;
  phone: string;
  isOnDuty: boolean;
  propertyName: string;
};

export type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  userPhone: string | null;
  userEmail: string | null;
  userRole: Role;
  userProfile: UserProfile | null;
  guardProfile: GuardProfile | null;
  isOnboarded: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  updateProfile: (profile: UserProfile) => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: React.ReactNode;
  allowedRoles: NonNullable<Role>[];
  tokenKey: string;
  refreshTokenKey: string;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, allowedRoles, tokenKey, refreshTokenKey }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [guardProfile, setGuardProfile] = useState<GuardProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(async () => {
    setIsAuthenticated(false);
    setUserId(null);
    setUserPhone(null);
    setUserEmail(null);
    setUserRole(null);
    setIsOnboarded(false);
    setUserProfile(null);
    setGuardProfile(null);
    await tokenStorage.deleteItemAsync(tokenKey).catch(() => {});
    await tokenStorage.deleteItemAsync(refreshTokenKey).catch(() => {});
  }, [tokenKey, refreshTokenKey]);

  const hydrateFromMe = useCallback(async () => {
    const response = await api.get('/auth/me');
    const { data } = response.data;
    
    // Role based authorization
    if (!allowedRoles.includes(data.role)) {
      await clearSession();
      throw new Error(`This account is not authorized to access this application.`);
    }

    setIsAuthenticated(true);
    setUserId(data.id ?? null);
    setUserRole(data.role as Role);
    setUserPhone(data.phone ?? null);
    setUserEmail(data.email ?? null);
    
    // Set Resident Profile
    if (data.resident) {
      setUserProfile({
        name: data.resident.name ?? '',
        phone: data.phone ?? '',
        email: data.email ?? null,
        wing: data.resident.unit?.tower ?? '',
        flat: data.resident.unit?.unitNumber ?? '',
        propertyName: data.resident.unit?.property?.name ?? '',
        residentType: data.resident.residentType,
        isPrimary: data.resident.isPrimary,
        relationship: data.resident.relationship,
        photoUri: null,
      });
      setIsOnboarded(true);
    } else {
      setUserProfile(null);
      if (data.role === 'RESIDENT') setIsOnboarded(false);
      else setIsOnboarded(true);
    }

    // Set Guard Profile
    if (data.guard) {
      setGuardProfile({
        name: data.guard.name,
        badgeNumber: data.guard.badgeNumber,
        phone: data.phone ?? '',
        isOnDuty: data.guard.isOnDuty,
        propertyName: data.guard.property?.name ?? '',
      });
    } else {
      setGuardProfile(null);
    }
  }, [allowedRoles, clearSession]);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await tokenStorage.getItemAsync(tokenKey);
        if (token) {
          await hydrateFromMe();
        }
      } catch (e) {
        await clearSession();
      }
      setIsLoading(false);
    };
    bootstrapAsync();
  }, [tokenKey, hydrateFromMe, clearSession]);

  // Deliberately does NOT touch isLoading — that flag gates AppNavigator's
  // `if (isLoading) return null`, meant only for the cold-start bootstrap
  // check. Toggling it here used to unmount the entire navigator (including
  // the login screen itself) for the duration of the login request, showing
  // a blank/black screen until it resolved. LoginScreen already tracks its
  // own `loading` state for the button spinner.
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { data } = response.data;

      if (!allowedRoles.includes(data.user.role)) {
        throw new Error(`This account is not authorized to access this application.`);
      }

      await tokenStorage.setItemAsync(tokenKey, data.accessToken);
      await tokenStorage.setItemAsync(refreshTokenKey, data.refreshToken);
      await hydrateFromMe();
    } catch (error) {
      await clearSession();
      throw error;
    }
  };

  const signup = async (email: string, password: string): Promise<void> => {
    await api.post('/auth/signup', { email, password, role: 'RESIDENT' });
    await login(email, password);
  };

  const updateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    setIsOnboarded(true);
  };

  const logout = async () => {
    const refreshToken = await tokenStorage.getItemAsync(refreshTokenKey).catch(() => null);
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    await clearSession();
  };

  const logoutAllDevices = async () => {
    try {
      await api.post('/auth/logout-all');
    } catch {}
    await logout();
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, userId, userPhone, userEmail, userRole, 
      userProfile, guardProfile, isOnboarded, 
      login, signup, logout, logoutAllDevices, updateProfile, refreshProfile: hydrateFromMe
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
