import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform, NativeModules } from 'react-native';

const getApiUrl = () => {
  let url = Platform.OS === 'android' ? 'http://10.0.2.2:5000/api/v1' : 'http://localhost:5000/api/v1';

  if (process.env.EXPO_PUBLIC_API_URL) {
    url = process.env.EXPO_PUBLIC_API_URL;
  } else {
    // 1. Try to get LAN IP from Expo Config
    if (Constants.expoConfig?.hostUri) {
      const ip = Constants.expoConfig.hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        url = `http://${ip}:5000/api/v1`;
        console.log('🌍 API_URL resolved from hostUri:', url);
        return url;
      }
    }

    // 2. Try to get IP from scriptURL (Metro Bundler URL)
    if (__DEV__) {
      const scriptURL = NativeModules.SourceCode?.scriptURL;
      if (scriptURL) {
        let host = null;
        try {
          const urlObj = new URL(scriptURL);
          host = urlObj.hostname;
        } catch (e) {
          const ipMatch = scriptURL.match(/\/\/([^:/]+)/);
          if (ipMatch) host = ipMatch[1];
        }

        if (host) {
          // If on a physical device over USB, scriptURL might be localhost. 
          // 10.0.2.2 only works for Emulators. For a physical device on the same WiFi, we fallback to a hardcoded local IP if needed,
          // but we'll try the known LAN IP first if localhost is detected.
          if (host === 'localhost' || host === '127.0.0.1') {
            host = '192.168.1.15'; // Automatically resolved LAN IP
          }
          url = `http://${host}:5000/api/v1`;
        }
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        url = `http://${window.location.hostname}:5000/api/v1`;
      }
    }
  }

  console.log('🌍 API_URL resolved to:', url);
  return url;
};

export const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to every request
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Event bus for authentication events (e.g. force logout)
type Listener = () => void;
class AuthEventEmitter {
  private listeners: Listener[] = [];
  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }
  emitForceLogout() {
    this.listeners.forEach(l => l());
  }
}
export const authEvents = new AuthEventEmitter();

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void, reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

// Interceptor for handling 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Ignore 401s on login/refresh endpoints
    if (originalRequest.url?.includes('/auth/email/login') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Must use axios directly to avoid interceptor loop
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        
        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;
        
        await SecureStore.setItemAsync('userToken', newAccessToken);
        await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        
        processQueue(null, newAccessToken);
        
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Dispatch global logout event
        await SecureStore.deleteItemAsync('userToken');
        await SecureStore.deleteItemAsync('refreshToken');
        authEvents.emitForceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
