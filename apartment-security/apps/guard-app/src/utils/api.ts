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
  // Render's free tier spins down after inactivity and can take 50s+ to wake
  // back up — 8s was reporting that cold start as a generic "Network Error".
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Multi-KB base64 photo payloads (gatePhotoBase64, photoBase64, ...) are huge and
// unreadable in a log line — never print them, even in dev.
function loggableData(data: unknown) {
  if (data && typeof data === 'object' && Object.keys(data).some((k) => k.toLowerCase().includes('base64'))) {
    return '[base64 payload omitted]';
  }
  return data ?? '';
}

// Interceptor to add JWT token to every request and log API calls (dev only)
api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getItemAsync('guardToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (__DEV__) {
      console.log(`🚀 [Guard API Request] ${config.method?.toUpperCase()} ${config.url}`, loggableData(config.data));
    }
    return config;
  },
  (error) => {
    console.error('❌ [Guard API Request Error]', error);
    return Promise.reject(error);
  }
);

// Interceptor for handling responses and errors
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`✅ [Guard API Response ${response.status}] ${response.config.method?.toUpperCase()} ${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    console.error(
      `❌ [Guard API Error ${error.response?.status ?? 'NET_ERR'}] ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
      error.response?.data?.message ?? error.message
    );
    if (error.response?.status === 401) {
      await tokenStorage.deleteItemAsync('guardToken');
    }
    return Promise.reject(error);
  }
);

export default api;

