import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '@apartment-security/shared-auth';

export type WorkerType =
  | 'MAID'
  | 'COOK'
  | 'DRIVER'
  | 'NANNY'
  | 'ELECTRICIAN'
  | 'PLUMBER'
  | 'GARDENER'
  | 'SECURITY_GUARD'
  | 'OTHER';

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type DomesticWorker = {
  id: string;
  name: string;
  phone: string;
  type: WorkerType;
  address?: string;
  photoUrl?: string;
  govtIdType?: string;
  govtIdNumber?: string;
  workingDays: DayOfWeek[];
  entryTime: string;
  exitTime: string;
  notes?: string;
  createdAt: string;
};

const mapWorker = (raw: any): DomesticWorker => ({
  id: raw.id,
  name: raw.name,
  phone: raw.phone,
  type: raw.type,
  address: raw.address ?? undefined,
  photoUrl: raw.photoUrl ?? undefined,
  govtIdType: raw.govtIdType ?? undefined,
  govtIdNumber: raw.govtIdNumber ?? undefined,
  workingDays: raw.workingDays ?? [],
  entryTime: raw.entryTime,
  exitTime: raw.exitTime,
  notes: raw.notes ?? undefined,
  createdAt: raw.createdAt,
});

export type WorkerInput = {
  name: string;
  phone: string;
  type: WorkerType;
  address?: string;
  photoUrl?: string;
  govtIdType?: string;
  govtIdNumber?: string;
  workingDays: DayOfWeek[];
  entryTime: string;
  exitTime: string;
  notes?: string;
};

type DomesticWorkersContextType = {
  workers: DomesticWorker[];
  loading: boolean;
  error: string | null;
  fetchWorkers: () => Promise<void>;
  createWorker: (input: WorkerInput) => Promise<DomesticWorker>;
  updateWorker: (id: string, input: WorkerInput) => Promise<DomesticWorker>;
  deleteWorker: (id: string) => Promise<void>;
  uploadWorkerPhoto: (localUri: string, mimeType: string, fileName: string) => Promise<string>;
  lastFetchedAt: React.MutableRefObject<number>;
};

const DomesticWorkersContext = createContext<DomesticWorkersContextType | undefined>(undefined);

export const DomesticWorkersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userRole } = useAuth();
  const [workers, setWorkers] = useState<DomesticWorker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/domestic-workers');
      const raw: any[] = response.data.data ?? [];
      setWorkers(raw.map(mapWorker));
      lastFetchedAt.current = Date.now();
    } catch (err) {
      console.error('Failed to fetch domestic workers:', err);
      setError('Failed to load domestic workers. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createWorker = useCallback(async (input: WorkerInput) => {
    const response = await api.post('/domestic-workers', input);
    const mapped = mapWorker(response.data.data);
    setWorkers((prev) => [mapped, ...prev]);
    return mapped;
  }, []);

  const updateWorker = useCallback(async (id: string, input: WorkerInput) => {
    const response = await api.put(`/domestic-workers/${id}`, input);
    const mapped = mapWorker(response.data.data);
    setWorkers((prev) => prev.map((w) => (w.id === id ? mapped : w)));
    return mapped;
  }, []);

  const deleteWorker = useCallback(async (id: string) => {
    await api.delete(`/domestic-workers/${id}`);
    setWorkers((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const uploadWorkerPhoto = useCallback(async (localUri: string, mimeType: string, fileName: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: fileName || `worker-${Date.now()}.jpg`,
      type: mimeType || 'image/jpeg',
    } as any);
    const response = await api.post('/domestic-workers/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(data) => data],
    });
    return response.data.data.url as string;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (userRole === 'RESIDENT') {
      fetchWorkers();
    }
  }, [isAuthenticated, userRole, fetchWorkers]);

  const value = useMemo<DomesticWorkersContextType>(() => ({
    workers, loading, error, fetchWorkers, createWorker, updateWorker, deleteWorker, uploadWorkerPhoto, lastFetchedAt,
  }), [workers, loading, error, fetchWorkers, createWorker, updateWorker, deleteWorker, uploadWorkerPhoto]);

  return <DomesticWorkersContext.Provider value={value}>{children}</DomesticWorkersContext.Provider>;
};

export const useDomesticWorkers = () => {
  const context = useContext(DomesticWorkersContext);
  if (context === undefined) {
    throw new Error('useDomesticWorkers must be used within a DomesticWorkersProvider');
  }
  return context;
};
