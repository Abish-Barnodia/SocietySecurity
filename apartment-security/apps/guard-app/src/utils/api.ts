import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import tokenStorage from './tokenStorage';

// Fallback for Android Emulator is 10.0.2.2, but for physical devices we need the LAN IP
const debuggerHost = Constants.expoConfig?.hostUri;
const isTunnel = debuggerHost?.includes('exp.direct') || debuggerHost?.includes('ngrok');
const localhost = Platform.OS === 'web'
  ? 'localhost'
  : (debuggerHost && !isTunnel
      ? debuggerHost.split(':')[0]
      : (Platform.OS === 'android' ? '10.0.2.2' : 'localhost'));

export const API_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? `https://societysecurity.onrender.com/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to every request
api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getItemAsync('guardToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor for handling 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStorage.deleteItemAsync('guardToken');
    }
    return Promise.reject(error);
  }
);

export default api;
