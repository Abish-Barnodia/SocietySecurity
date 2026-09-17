import { request } from './api';

export const authService = {
  login: async (email: string, password: string) => {
    const data = await request<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; role: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.user.role !== 'SUPER_ADMIN') {
      throw new Error('Access denied. Only Platform Super Admins can access this panel.');
    }

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('superadmin_token', data.accessToken);
    localStorage.setItem('superadmin_user', JSON.stringify(data.user));

    return data;
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user') || localStorage.getItem('superadmin_user');
    if (!userStr) return null;
    try {
      const u = JSON.parse(userStr);
      return u?.role === 'SUPER_ADMIN' ? u : null;
    } catch {
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('superadmin_token');
    localStorage.removeItem('superadmin_user');
    window.dispatchEvent(new Event('manager-session-expired'));
  },
};
