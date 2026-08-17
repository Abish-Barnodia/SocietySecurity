import axios from 'axios';

let currentTokenGetter: () => Promise<string | null> = async () => null;
let currentOnUnauthorized: () => Promise<void> = async () => {};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export const configureApi = (
  baseUrl: string,
  tokenGetter: () => Promise<string | null>,
  onUnauthorized: () => Promise<void>
) => {
  api.defaults.baseURL = baseUrl;
  currentTokenGetter = tokenGetter;
  currentOnUnauthorized = onUnauthorized;
};

api.interceptors.request.use(
  async (config) => {
    const token = await currentTokenGetter();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await currentOnUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
