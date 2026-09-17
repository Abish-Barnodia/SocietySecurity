import { request } from './api';
import {
  PlatformStatsResponse,
  Society,
  Manager,
  PlatformAuditLog,
  SocietyStatus,
  DemoRequest,
} from '../types';

export const superAdminService = {
  getPlatformStats: () => request<PlatformStatsResponse>('/super-admin/stats'),

  getSocieties: (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return request<{ items: Society[]; pagination: any }>(`/super-admin/societies?${query.toString()}`);
  },

  getSocietyById: (id: string) => request<Society>(`/super-admin/societies/${id}`),

  createSociety: (data: {
    name: string;
    address?: string;
    city?: string;
    pincode?: string;
    email?: string;
    phone?: string;
    totalUnits?: number;
    totalTowers?: number;
    subscriptionPlan?: string;
    managerName: string;
    managerEmail: string;
    managerPhone: string;
    managerPassword?: string;
  }) => request<{ society: Society; manager: Manager; credentials: any }>('/super-admin/societies', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateSocietyStatus: (id: string, status: SocietyStatus) =>
    request<Society>(`/super-admin/societies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  updateSociety: (id: string, data: Partial<Society>) =>
    request<Society>(`/super-admin/societies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAllManagers: (search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<Manager[]>(`/super-admin/managers${query}`);
  },

  getAuditLogs: () => request<PlatformAuditLog[]>('/super-admin/audit-logs'),

  // Demo Requests
  getDemoRequests: (status?: string, search?: string) => {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    if (search) query.append('search', search);
    return request<DemoRequest[]>(`/demo-requests?${query.toString()}`);
  },

  updateDemoStatus: (id: string, status: string, notes?: string) =>
    request<DemoRequest>(`/demo-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }),

  approveAndProvisionDemo: (id: string, data: {
    managerName: string;
    managerEmail: string;
    managerPhone: string;
    managerPassword?: string;
    address?: string;
    city?: string;
    pincode?: string;
    totalUnits?: number;
    totalTowers?: number;
    subscriptionPlan?: string;
  }) => request<{ society: Society; manager: Manager; credentials: any }>(`/demo-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Real Subscriptions
  getSubscriptionPlans: () => request<import('../types').SubscriptionPlanItem[]>('/super-admin/subscription-plans'),

  // Real Platform Settings
  getPlatformSettings: () => request<import('../types').PlatformSettingsMap>('/super-admin/settings'),

  updatePlatformSettings: (data: Partial<import('../types').PlatformSettingsMap>) =>
    request<import('../types').PlatformSettingsMap>('/super-admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

