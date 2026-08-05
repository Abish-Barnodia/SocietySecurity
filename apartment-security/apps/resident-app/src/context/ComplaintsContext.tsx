import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '@apartment-security/shared-auth';

export type ComplaintCategory =
  | 'MAINTENANCE'
  | 'SECURITY'
  | 'NOISE'
  | 'PARKING'
  | 'CLEANLINESS'
  | 'BILLING'
  | 'STAFF_BEHAVIOR'
  | 'AMENITY'
  | 'OTHER';

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type ComplaintUpdateEntry = {
  id: string;
  action: string;
  note?: string;
  actorRole: string;
  createdAt: string;
};

export type Complaint = {
  id: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  title: string;
  description: string;
  attachmentUrls: string[];
  assignedToName?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
  updates: ComplaintUpdateEntry[];
  residentName: string;
  unit?: string;
};

const formatUnit = (unit?: { unitNumber?: string; tower?: string | null } | null) => {
  if (!unit?.unitNumber) return undefined;
  return unit.tower ? `${unit.tower} - ${unit.unitNumber}` : unit.unitNumber;
};

const mapComplaint = (raw: any): Complaint => ({
  id: raw.id,
  category: raw.category,
  priority: raw.priority,
  status: raw.status,
  title: raw.title,
  description: raw.description,
  attachmentUrls: raw.attachmentUrls ?? [],
  assignedToName: raw.assignedToName ?? undefined,
  resolutionNote: raw.resolutionNote ?? undefined,
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
  updates: (raw.updates ?? []).map((u: any) => ({
    id: u.id,
    action: u.action,
    note: u.note ?? undefined,
    actorRole: u.actorRole,
    createdAt: u.createdAt,
  })),
  residentName: raw.resident?.name ?? '',
  unit: formatUnit(raw.resident?.unit),
});

export type ComplaintFilters = {
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  q?: string;
  sort?: 'newest' | 'oldest';
};

type CreateComplaintInput = {
  category: ComplaintCategory;
  priority: ComplaintPriority;
  title: string;
  description: string;
  attachmentUrls?: string[];
};

type ComplaintsContextType = {
  complaints: Complaint[];
  loading: boolean;
  error: string | null;
  fetchComplaints: (filters?: ComplaintFilters) => Promise<void>;
  fetchComplaintDetail: (id: string) => Promise<Complaint>;
  createComplaint: (input: CreateComplaintInput) => Promise<Complaint>;
  uploadAttachment: (localUri: string, mimeType: string, fileName: string) => Promise<string>;
};

const ComplaintsContext = createContext<ComplaintsContextType | undefined>(undefined);

export const ComplaintsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userRole } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComplaints = useCallback(async (filters?: ComplaintFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/complaints', { params: filters });
      const raw: any[] = response.data.data ?? [];
      setComplaints(raw.map(mapComplaint));
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
      setError('Failed to load complaints. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchComplaintDetail = useCallback(async (id: string) => {
    const response = await api.get(`/complaints/${id}`);
    const mapped = mapComplaint(response.data.data);
    setComplaints((prev) => (prev.some((c) => c.id === mapped.id) ? prev.map((c) => (c.id === mapped.id ? mapped : c)) : [mapped, ...prev]));
    return mapped;
  }, []);

  const createComplaint = useCallback(async (input: CreateComplaintInput) => {
    const response = await api.post('/complaints', input);
    const mapped = mapComplaint(response.data.data);
    setComplaints((prev) => [mapped, ...prev]);
    return mapped;
  }, []);

  const uploadAttachment = useCallback(async (localUri: string, mimeType: string, fileName: string) => {
    const formData = new FormData();
    formData.append('file', { uri: localUri, name: fileName, type: mimeType } as any);
    const response = await api.post('/complaints/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.url as string;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (userRole === 'RESIDENT') {
      fetchComplaints();
    }
  }, [isAuthenticated, userRole, fetchComplaints]);

  return (
    <ComplaintsContext.Provider
      value={{ complaints, loading, error, fetchComplaints, fetchComplaintDetail, createComplaint, uploadAttachment }}
    >
      {children}
    </ComplaintsContext.Provider>
  );
};

export const useComplaints = () => {
  const context = useContext(ComplaintsContext);
  if (context === undefined) {
    throw new Error('useComplaints must be used within a ComplaintsProvider');
  }
  return context;
};
