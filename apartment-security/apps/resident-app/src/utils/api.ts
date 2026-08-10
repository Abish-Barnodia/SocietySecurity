import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import tokenStorage from './tokenStorage';

// Fallback for Android Emulator is 10.0.2.2, but for physical devices we need the LAN IP
const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = Platform.OS === 'web'
  ? 'localhost'
  : (debuggerHost ? debuggerHost.split(':')[0] : '10.0.2.2');

export const API_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? `http://${localhost}:5000/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to every request
api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getItemAsync('userToken');
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
      // You could trigger a global logout here by dispatching an event
      await tokenStorage.deleteItemAsync('userToken');
    }
    return Promise.reject(error);
  }
);

export default api;
