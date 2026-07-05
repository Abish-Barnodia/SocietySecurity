import React, { createContext, useState, useContext, useEffect } from 'react';
import { colors } from '../theme/colors';
import api from '../utils/api';

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
  status: 'Entered' | 'Exited' | 'Denied';
  method: string;
  gate?: string;
  statusColor: string;
  date: 'TODAY' | 'YESTERDAY';
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
  updatePassStatus: (id: string, status: Pass['status']) => void;
  fetchPasses: () => Promise<void>;
  createPass: (data: Partial<Pass>) => Promise<void>;
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  fetchAlerts: () => Promise<void>;
  entries: Entry[];
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

  const fetchPasses = async () => {
    try {
      const response = await api.get('/passes');
      // Assuming backend returns an array of passes directly matching this structure or needing mapping
      setPasses(response.data.passes || response.data);
    } catch (error) {
      console.error('Failed to fetch passes:', error);
    }
  };

  const createPass = async (data: Partial<Pass>) => {
    try {
      const response = await api.post('/passes', data);
      const newPass = response.data.pass || response.data;
      setPasses((prev) => [newPass, ...prev]);
    } catch (error) {
      console.error('Failed to create pass:', error);
      throw error;
    }
  };

  const addPass = (pass: Pass) => setPasses((prev) => [pass, ...prev]);
  
  const updatePassStatus = (id: string, status: Pass['status']) => {
    setPasses((prev) => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/alerts');
      setAlerts(response.data.alerts || response.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const addAlert = (alert: Alert) => setAlerts((prev) => [alert, ...prev]);
  
  const markAlertRead = (id: string) => {
    setAlerts((prev) => prev.map(a => a.id === id ? { ...a, unread: false } : a));
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

  // Optionally fetch initial data on mount (if authenticated context allows it)
  // useEffect(() => { fetchPasses(); fetchAlerts(); }, []);

  return (
    <DataContext.Provider value={{ 
      passes, addPass, updatePassStatus, fetchPasses, createPass,
      alerts, addAlert, markAlertRead, fetchAlerts,
      entries, addEntry,
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
