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

let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    const refreshToken = localStorage.getItem('managerRefreshToken');
    if (!refreshToken) {
      localStorage.removeItem('managerToken');
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve) => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }
    original._retry = true;
    isRefreshing = true;
    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = data.data;
      localStorage.setItem('managerToken', accessToken);
      localStorage.setItem('managerRefreshToken', newRefresh);
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      queue.forEach((cb) => cb(accessToken));
      queue = [];
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch {
      localStorage.removeItem('managerToken');
      localStorage.removeItem('managerRefreshToken');
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
