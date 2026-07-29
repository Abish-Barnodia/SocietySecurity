import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';
import { Pass, Alert, Entry, Member, ScanRequest, EmergencyContact, AlertPreferences } from './DataContext';

// ---------------- PASS CONTEXT ----------------
type PassContextType = {
  passes: Pass[];
  addPass: (pass: Pass) => void;
  updatePassStatus: (id: string, action: 'suspend' | 'revoke') => Promise<void>;
  deletePass: (id: string) => Promise<void>;
  fetchPasses: () => Promise<void>;
  createPass: (data: any) => Promise<void>;
};
const PassContext = createContext<PassContextType | undefined>(undefined);

export const PassProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [passes, setPasses] = useState<Pass[]>([]);
  const { isAuthenticated, userRole } = useAuth();

  const mapBackendPassToFrontend = (p: any): Pass => {
    if (p.name && !p.visitorName) return p as Pass;
    let typeStr = 'One-time visitor';
    if (p.type === 'RECURRING') typeStr = 'Recurring';
    if (p.type === 'DELIVERY') typeStr = 'Delivery / service';
    if (p.type === 'CONTRACTOR') typeStr = 'Contractor';

    let statusStr: 'Active' | 'Suspended' | 'Expired' = 'Active';
    if (p.status === 'SUSPENDED') statusStr = 'Suspended';
    if (p.status === 'EXPIRED') statusStr = 'Expired';
    if (p.status === 'REVOKED') statusStr = 'Expired'; // Map revoked to expired for UI

    return {
      id: p.id, name: p.visitorName || 'Unknown', type: typeStr, status: statusStr,
      time: p.validFrom ? new Date(p.validFrom).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Invalid Date',
      purpose: p.purpose || 'Visit', phone: p.visitorPhone,
      color: statusStr === 'Active' ? '#10b981' : '#f43f5e',
      created: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '', 
      gate: p.unitId, qrPayload: p.qrPayload
    };
  };

  const fetchPasses = async () => {
    if (userRole === 'GUARD') return; // Guards don't fetch passes this way
    try {
      const response = await api.get('/passes');
      const backendPasses = response.data.data?.passes || response.data.data || [];
      setPasses(backendPasses.map(mapBackendPassToFrontend));
    } catch (error) { console.error('Failed to fetch passes:', error); }
  };

  const createPass = async (data: any) => {
    try {
      const response = await api.post('/passes', data);
      const newPass = response.data?.data?.pass || response.data?.pass || response.data;
      setPasses((prev) => [mapBackendPassToFrontend(newPass), ...prev]);
    } catch (error: any) { throw new Error(error.response?.data?.message || 'Failed to create pass'); }
  };

  const updatePassStatus = async (id: string, action: 'suspend' | 'revoke') => {
    // Optimistic UI update
    setPasses((prev) => prev.map(p => p.id === id ? { ...p, status: action === 'suspend' ? 'Suspended' : 'Expired' } : p));
    try {
      await api.put(`/passes/${id}/${action}`);
    } catch (e) {
      fetchPasses();
      throw e;
    }
  };

  const deletePass = async (id: string) => {
    // Optimistic UI update to make deletion feel instant
    setPasses((prev) => prev.filter(p => p.id !== id));
    try {
      await api.delete(`/passes/${id}`);
    } catch (e) {
      // Revert/refresh if it fails
      fetchPasses();
      throw e;
    }
  };

  useEffect(() => { if (isAuthenticated) fetchPasses(); }, [isAuthenticated, userRole]);

  return <PassContext.Provider value={{ passes, addPass: (p) => setPasses(prev => [p, ...prev]), updatePassStatus, deletePass, fetchPasses, createPass }}>{children}</PassContext.Provider>;
};
export const usePasses = () => { const ctx = useContext(PassContext); if (!ctx) throw new Error('usePasses must be used within PassProvider'); return ctx; };

// ---------------- ALERT CONTEXT ----------------
type AlertContextType = { alerts: Alert[]; addAlert: (a: Alert) => void; markAlertRead: (id: string) => void; fetchAlerts: () => Promise<void>; };
const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const { isAuthenticated } = useAuth();
  const fetchAlerts = async () => { try { const res = await api.get('/alerts'); setAlerts(res.data.data || []); } catch(e) { console.error(e); } };
  useEffect(() => { if (isAuthenticated) fetchAlerts(); }, [isAuthenticated]);
  
  return <AlertContext.Provider value={{ alerts, addAlert: (a) => setAlerts(prev => [a, ...prev]), markAlertRead: (id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, unread: false } : a)), fetchAlerts }}>{children}</AlertContext.Provider>;
};
export const useAlerts = () => { const ctx = useContext(AlertContext); if (!ctx) throw new Error('useAlerts must be used within AlertProvider'); return ctx; };

// ---------------- ENTRY CONTEXT ----------------
type EntryContextType = { entries: Entry[]; fetchEntries: () => Promise<void>; addEntry: (e: Entry) => void; };
const EntryContext = createContext<EntryContextType | undefined>(undefined);

export const EntryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const { isAuthenticated, userRole } = useAuth();

  const mapBackendEntryToFrontend = (e: any): Entry => {
    const d = new Date(e.entryAt); const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    let dateStr: any = 'OTHER';
    if (d.toDateString() === today.toDateString()) dateStr = 'TODAY';
    else if (d.toDateString() === yesterday.toDateString()) dateStr = 'YESTERDAY';
    let statusStr: any = e.exitAt ? 'EXITED' : 'ENTERED';
    let typeStr = 'Visitor';
    if (e.pass?.type === 'DELIVERY') typeStr = 'Delivery'; if (e.pass?.type === 'CONTRACTOR') typeStr = 'Worker';
    return {
      id: e.id, name: e.visitorName || e.pass?.visitorName || 'Unknown', initials: (e.visitorName || e.pass?.visitorName || 'U')[0].toUpperCase(),
      color: '#e5e7eb', time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: statusStr, type: typeStr,
      gate: e.guard?.name || 'Main Gate', statusColor: statusStr === 'ENTERED' ? '#10b981' : '#6c757d', date: dateStr,
    };
  };

  const fetchEntries = async () => {
    try {
      const endpoint = (userRole === 'MANAGER' || userRole === 'COMMITTEE') ? '/entries/all' : '/entries';
      const response = await api.get(endpoint);
      let rawData = response.data.data;
      setEntries((Array.isArray(rawData) ? rawData : (rawData?.entries || [])).map(mapBackendEntryToFrontend));
    } catch (e) { console.error('Failed to fetch entries:', e); }
  };
  useEffect(() => { if (isAuthenticated) fetchEntries(); }, [isAuthenticated, userRole]);

  return <EntryContext.Provider value={{ entries, fetchEntries, addEntry: (e) => setEntries(prev => [e, ...prev]) }}>{children}</EntryContext.Provider>;
};
export const useEntries = () => { const ctx = useContext(EntryContext); if (!ctx) throw new Error('useEntries must be used within EntryProvider'); return ctx; };

// ---------------- GUARD CONTEXT ----------------
type GuardContextType = { scanRequests: ScanRequest[]; addScanRequest: (r: ScanRequest) => void; updateScanRequestStatus: (id: string, s: ScanRequest['status']) => void; };
const GuardContext = createContext<GuardContextType | undefined>(undefined);
export const GuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scanRequests, setScanRequests] = useState<ScanRequest[]>([]);
  return <GuardContext.Provider value={{ scanRequests, addScanRequest: (r) => setScanRequests(prev => [r, ...prev]), updateScanRequestStatus: (id, s) => setScanRequests(prev => prev.map(req => req.id === id ? { ...req, status: s } : req)) }}>{children}</GuardContext.Provider>;
};
export const useGuardState = () => { const ctx = useContext(GuardContext); if (!ctx) throw new Error('useGuardState must be used within GuardProvider'); return ctx; };

// ---------------- HOUSEHOLD CONTEXT ----------------
type HouseholdContextType = {
  members: Member[]; addMember: (m: Member) => void; deleteMember: (id: string) => void;
  emergencyContacts: EmergencyContact[]; addEmergencyContact: (c: EmergencyContact) => void; removeEmergencyContact: (id: string) => void;
  alertPreferences: AlertPreferences; updateAlertPreferences: (p: Partial<AlertPreferences>) => void;
};
const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);
export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [alertPreferences, setAlertPreferences] = useState<AlertPreferences>({ pushEnabled: true, smsEnabled: false, staffEnabled: true });
  return <HouseholdContext.Provider value={{ members, addMember: (m) => setMembers(prev => [...prev, m]), deleteMember: (id) => setMembers(prev => prev.filter(m => m.id !== id)), emergencyContacts, addEmergencyContact: (c) => setEmergencyContacts(prev => [...prev, c]), removeEmergencyContact: (id) => setEmergencyContacts(prev => prev.filter(c => c.id !== id)), alertPreferences, updateAlertPreferences: (p) => setAlertPreferences(prev => ({...prev, ...p})) }}>{children}</HouseholdContext.Provider>;
};
export const useHousehold = () => { const ctx = useContext(HouseholdContext); if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider'); return ctx; };

// ---------------- APP DOMAIN PROVIDER ----------------
// Wraps all the small contexts so we don't have to nest 5 providers in App.tsx manually
export const AppDomainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PassProvider>
      <AlertProvider>
        <EntryProvider>
          <GuardProvider>
            <HouseholdProvider>
              {children}
            </HouseholdProvider>
          </GuardProvider>
        </EntryProvider>
      </AlertProvider>
    </PassProvider>
  );
};
