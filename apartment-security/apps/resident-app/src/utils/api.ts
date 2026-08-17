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
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to every request and log API calls
api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getItemAsync('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Request bodies can contain PII (phone numbers, names) — never log in production.
    if (__DEV__) {
      console.log(`🚀 [API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data ?? '');
    }
    return config;
  },
  (error) => {
    if (__DEV__) console.error('❌ [API Request Error]', error);
    return Promise.reject(error);
  }
);

// Interceptor for handling responses and errors
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`✅ [API Response ${response.status}] ${response.config.method?.toUpperCase()} ${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    if (__DEV__) {
      console.error(
        `❌ [API Error ${error.response?.status ?? 'NET_ERR'}] ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        error.response?.data?.message ?? error.message
      );
    }
    if (error.response?.status === 401) {
      await tokenStorage.deleteItemAsync('userToken');
    }
    return Promise.reject(error);
  }
);

export default api;
