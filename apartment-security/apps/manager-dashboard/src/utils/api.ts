import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('managerToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem('managerToken');
    return Promise.reject(error);
  }
);

export default api;
