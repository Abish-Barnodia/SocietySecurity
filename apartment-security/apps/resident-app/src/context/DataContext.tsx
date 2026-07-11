import React, { createContext, useState, useContext, useEffect } from 'react';
import { colors } from '../theme/colors';
import api from '../utils/api';
import { useAuth } from './AuthContext';

export type Pass = {
  id: string;
  name: string;
  type: string;
  status: 'Active' | 'Suspended' | 'Expired';
  time: string;
  purpose: string;
  phone?: string;
  color: string;
  created: string;
  gate?: string;
  qrPayload?: string; // HMAC-signed payload returned by backend; used for QR code rendering
};

export type Alert = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  unread: boolean;
};

export type Entry = {
  id: string;
  name: string;
  initials: string;
  color: string;
  time: string;
  status: 'ENTERED' | 'EXITED' | 'DENIED';
  type: string;
  gate?: string;
  statusColor: string;
  date: 'TODAY' | 'YESTERDAY' | 'OTHER';
};

export type Member = {
  id: string;
  name: string;
  phone: string;
  initials: string;
  color: string;
  isPrimary: boolean;
};

export type ScanRequest = {
  id: string;
  passId?: string;
  visitorName: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  time: string;
};

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation: string;
};

export type AlertPreferences = {
  pushEnabled: boolean;
  smsEnabled: boolean;
  staffEnabled: boolean;
};

type DataContextType = {
  passes: Pass[];
  addPass: (pass: Pass) => void;
  updatePassStatus: (id: string, action: 'suspend' | 'revoke') => Promise<void>;
  fetchPasses: () => Promise<void>;
  createPass: (data: any) => Promise<void>;
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  fetchAlerts: () => Promise<void>;
  entries: Entry[];
  fetchEntries: () => Promise<void>;
  addEntry: (entry: Entry) => void;
  members: Member[];
  addMember: (member: Member) => void;
  deleteMember: (id: string) => void;
  scanRequests: ScanRequest[];
  addScanRequest: (request: ScanRequest) => void;
  updateScanRequestStatus: (id: string, status: ScanRequest['status']) => void;
  emergencyContacts: EmergencyContact[];
  addEmergencyContact: (contact: EmergencyContact) => void;
  removeEmergencyContact: (id: string) => void;
  alertPreferences: AlertPreferences;
  updateAlertPreferences: (prefs: Partial<AlertPreferences>) => void;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [scanRequests, setScanRequests] = useState<ScanRequest[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [alertPreferences, setAlertPreferences] = useState<AlertPreferences>({
    pushEnabled: true,
    smsEnabled: false,
    staffEnabled: true,
  });

  const mapBackendPassToFrontend = (p: any): Pass => {
    if (p.name && !p.visitorName) return p as Pass;

    let typeStr = 'One-time visitor';
    if (p.type === 'RECURRING') typeStr = 'Recurring';
    if (p.type === 'DELIVERY') typeStr = 'Delivery / service';
    if (p.type === 'CONTRACTOR') typeStr = 'Contractor';

    let statusStr: 'Active' | 'Suspended' | 'Expired' = 'Active';
    if (p.status === 'SUSPENDED') statusStr = 'Suspended';
    if (p.status === 'EXPIRED') statusStr = 'Expired';

    return {
      id: p.id,
      name: p.visitorName || 'Unknown',
      type: typeStr,
      status: statusStr,
      time: new Date(p.validFrom).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
      purpose: p.purpose || 'Visit',
      phone: p.visitorPhone,
      color: statusStr === 'Active' ? '#10b981' : '#f43f5e',
      created: p.createdAt,
      gate: p.unitId,
      qrPayload: p.qrPayload
    };
  };

  const fetchPasses = async () => {
    try {
      const response = await api.get('/passes');
      const backendPasses = response.data.data || [];
      setPasses(backendPasses.map(mapBackendPassToFrontend));
    } catch (error) {
      console.error('Failed to fetch passes:', error);
    }
  };

  const createPass = async (data: any) => {
    try {
      const response = await api.post('/passes', data);
      const newPass = response.data.pass || response.data;
      setPasses((prev) => [mapBackendPassToFrontend(newPass), ...prev]);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to create pass';
      const details = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : '';
      console.error('Failed to create pass:', errorMsg, details);
      throw new Error(`${errorMsg} ${details}`);
    }
  };

  const addPass = (pass: Pass) => setPasses((prev) => [pass, ...prev]);
  
  // Calls the backend API to persist the status change, then updates local state.
  const updatePassStatus = async (id: string, action: 'suspend' | 'revoke') => {
    await api.put(`/passes/${id}/${action}`);
    const newStatus: Pass['status'] = action === 'suspend' ? 'Suspended' : 'Expired';
    setPasses((prev) => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/alerts');
      setAlerts(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const addAlert = (alert: Alert) => setAlerts((prev) => [alert, ...prev]);
  
  const markAlertRead = (id: string) => {
    setAlerts((prev) => prev.map(a => a.id === id ? { ...a, unread: false } : a));
  };

  const mapBackendEntryToFrontend = (e: any): Entry => {
    const d = new Date(e.entryAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateStr = 'OTHER';
    if (d.toDateString() === today.toDateString()) dateStr = 'TODAY';
    else if (d.toDateString() === yesterday.toDateString()) dateStr = 'YESTERDAY';

    let statusStr: 'ENTERED' | 'EXITED' = e.exitAt ? 'EXITED' : 'ENTERED';
    let typeStr = 'Visitor';
    if (e.pass?.type === 'DELIVERY') typeStr = 'Delivery';
    if (e.pass?.type === 'CONTRACTOR') typeStr = 'Worker';

    return {
      id: e.id,
      name: e.visitorName || e.pass?.visitorName || 'Unknown',
      initials: (e.visitorName || e.pass?.visitorName || 'U')[0].toUpperCase(),
      color: '#e5e7eb',
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: statusStr,
      type: typeStr,
      gate: e.guard?.name || 'Main Gate',
      statusColor: statusStr === 'ENTERED' ? '#10b981' : '#6c757d',
      date: dateStr as any,
    };
  };

  const fetchEntries = async () => {
    try {
      const endpoint = (userRole === 'MANAGER' || userRole === 'COMMITTEE') ? '/entries/all' : '/entries';
      const response = await api.get(endpoint);
      let rawData = response.data.data;
      let backendEntries: any[] = [];
      if (Array.isArray(rawData)) {
        backendEntries = rawData;
      } else if (rawData && Array.isArray(rawData.entries)) {
        backendEntries = rawData.entries;
      }
      setEntries(backendEntries.map(mapBackendEntryToFrontend));
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    }
  };

  const addEntry = (entry: Entry) => setEntries((prev) => [entry, ...prev]);

  const addMember = (member: Member) => setMembers((prev) => [...prev, member]);
  
  const deleteMember = (id: string) => setMembers((prev) => prev.filter(m => m.id !== id));

  const addScanRequest = (request: ScanRequest) => setScanRequests((prev) => [request, ...prev]);

  const updateScanRequestStatus = (id: string, status: ScanRequest['status']) => {
    setScanRequests((prev) => prev.map(req => req.id === id ? { ...req, status } : req));
  };

  const addEmergencyContact = (contact: EmergencyContact) => setEmergencyContacts((prev) => [...prev, contact]);
  const removeEmergencyContact = (id: string) => setEmergencyContacts((prev) => prev.filter(c => c.id !== id));
  const updateAlertPreferences = (prefs: Partial<AlertPreferences>) => setAlertPreferences((prev) => ({ ...prev, ...prefs }));

  const { isAuthenticated, userRole } = useAuth();

  // Only fetch data once the user is logged in
  useEffect(() => {
    if (isAuthenticated) {
      fetchPasses();
      fetchAlerts();
      fetchEntries();
    }
  }, [isAuthenticated, userRole]);


  return (
    <DataContext.Provider value={{ 
      passes, addPass, updatePassStatus, fetchPasses, createPass,
      alerts, addAlert, markAlertRead, fetchAlerts,
      entries, fetchEntries, addEntry,
      members, addMember, deleteMember,
      scanRequests, addScanRequest, updateScanRequestStatus,
      emergencyContacts, addEmergencyContact, removeEmergencyContact,
      alertPreferences, updateAlertPreferences
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
