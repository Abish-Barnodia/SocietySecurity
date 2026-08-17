import React, { createContext, useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { colors } from '../theme/colors';
import api from '../utils/api';
import { useAuth } from '@apartment-security/shared-auth';
import { scheduleLocalNotification } from '../utils/notifications';
import { useSocket } from './SocketContext';

export type Pass = {
  id: string;
  unitId: string;
  name: string;
  type: string;
  status: 'Active' | 'Suspended' | 'Expired';
  time: string;
  purpose: string;
  phone?: string;
  color: string;
  created: string;
  gate?: string;
  qrPayload?: string | null;
};

export type Alert = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  unread: boolean;
  entryId?: string;
  imageUrl?: string | null;
  claimedByUserId?: string | null;
  claimedByName?: string | null;
};

const PASS_STATUS_COLOR: Record<string, string> = {
  ACTIVE: colors.primary,
  SUSPENDED: colors.warning,
  EXPIRED: colors.textMuted,
  REVOKED: colors.danger,
};

const PASS_STATUS_LABEL: Record<string, Pass['status']> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  EXPIRED: 'Expired',
  REVOKED: 'Expired',
};

const formatTimeRange = (validFrom: string, validUntil: string) => {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  const from = new Date(validFrom).toLocaleTimeString([], opts);
  const until = new Date(validUntil).toLocaleTimeString([], opts);
  return `${from} - ${until}`;
};

// Maps the backend Pass record (visitorName/validFrom/validUntil/status enum, etc.)
// to the simpler shape the pass screens render.
const mapPass = (raw: any): Pass => ({
  id: raw.id,
  unitId: raw.unitId,
  name: raw.visitorName,
  type: raw.type,
  status: PASS_STATUS_LABEL[raw.status] ?? 'Active',
  time: raw.validFrom && raw.validUntil ? formatTimeRange(raw.validFrom, raw.validUntil) : '',
  purpose: raw.purpose ?? '',
  phone: raw.visitorPhone ?? undefined,
  color: PASS_STATUS_COLOR[raw.status] ?? colors.primary,
  created: raw.createdAt ? new Date(raw.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
  gate: raw.gate ?? undefined,
  qrPayload: raw.qrPayload ?? null,
});

const ALERT_PRIORITY_ICON: Record<string, string> = {
  P1: '🚨',
  P2: '⚠️',
  P3: '🔔',
};

const mapAlert = (raw: any): Alert => ({
  id: raw.id,
  title: raw.title,
  subtitle: raw.body,
  time: raw.createdAt ? new Date(raw.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
  icon: raw.priority ?? 'P3',  // store priority key; UI maps this to Ionicons
  unread: !raw.acknowledgedAt,
  entryId: raw.entryId ?? undefined,
  imageUrl: raw.imageUrl ?? null,
  claimedByUserId: raw.claimedByUserId ?? null,
  claimedByName: raw.claimedByName ?? null,
});

export type Entry = {
  id: string;
  name: string;
  initials: string;
  color: string;
  time: string;
  status: 'Entered' | 'Exited' | 'Denied' | 'Pending';
  method: string;
  gate?: string;
  statusColor: string;
  date: 'TODAY' | 'YESTERDAY' | 'EARLIER';
};

const ENTRY_METHOD_LABEL: Record<string, string> = {
  QR_SCAN: 'QR scan',
  OTP: 'OTP',
  MANUAL_GUARD: 'Walk-in',
  VEHICLE_ANPR: 'Vehicle',
};

const ENTRY_STATUS: Record<string, { label: Entry['status']; color: string }> = {
  APPROVED: { label: 'Entered', color: colors.success },
  DENIED: { label: 'Denied', color: colors.danger },
  NO_RESPONSE: { label: 'Denied', color: colors.danger },
  PENDING_APPROVAL: { label: 'Pending', color: colors.warning },
};

const AVATAR_PALETTE = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#0ea5e9'];
const colorForId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const mapEntry = (raw: any): Entry => {
  const entryDate = new Date(raw.entryAt);
  const today = startOfDay(new Date());
  const diffDays = Math.round((today - startOfDay(entryDate)) / 86400000);
  const status = raw.exitAt
    ? { label: 'Exited' as const, color: colors.textMuted }
    : ENTRY_STATUS[raw.status] ?? { label: 'Entered' as const, color: colors.success };

  return {
    id: raw.id,
    name: raw.visitorName,
    initials: (raw.visitorName || '?').charAt(0).toUpperCase(),
    color: colorForId(raw.id),
    time: entryDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    status: status.label,
    method: ENTRY_METHOD_LABEL[raw.method] ?? raw.method,
    gate: raw.entryPoint?.name ?? undefined,
    statusColor: status.color,
    date: diffDays === 0 ? 'TODAY' : diffDays === 1 ? 'YESTERDAY' : 'EARLIER',
  };
};

export type Member = {
  id: string;
  name: string;
  phone: string;
  initials: string;
  color: string;
  isPrimary: boolean;
};

const mapMember = (raw: any): Member => ({
  id: raw.id,
  name: raw.name,
  phone: raw.user?.phone ?? '',
  initials: (raw.name || '?').charAt(0).toUpperCase(),
  color: colorForId(raw.id),
  isPrimary: !!raw.isPrimary,
});

export type ScanRequest = {
  id: string;
  passId?: string;
  visitorName: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  time: string;
};

export type PendingWalkIn = {
  id: string;
  visitorName: string;
  purpose?: string;
  gatePhotoUrl?: string;
  time: string;
  // Only present for QR-scan-originated approval requests — a real
  // server-issued deadline, unlike the old manual-walkin items which have
  // no timeout at all (WalkInApprovalScreen falls back to its original
  // client-only behavior when this is absent).
  timeoutAt?: string;
  visitorPhoto?: string | null;
  vehicleNumber?: string | null;
  expectedTime?: string | null;
  apartment?: string | null;
  tower?: string | null;
  gateName?: string | null;
};

export type Amenity = {
  id: string;
  name: string;
  capacity: number;
  status: string;
  openTime: string;
  closeTime: string;
  timeLabel: string;
  icon: string;
};

const format12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${period}`;
};

const AMENITY_ICON: [RegExp, string][] = [
  [/gym/i, '💪'],
  [/pool/i, '🏊‍♂️'],
  [/club/i, '🎉'],
  [/guest/i, '🛏️'],
  [/park/i, '🅿️'],
  [/court|tennis|badminton/i, '🏸'],
  [/garden|park(?!ing)/i, '🌳'],
];
const iconForAmenity = (name: string) => AMENITY_ICON.find(([re]) => re.test(name))?.[1] ?? '🏢';

const mapAmenity = (raw: any): Amenity => ({
  id: raw.id,
  name: raw.name,
  capacity: raw.capacity,
  status: raw.status,
  openTime: raw.openTime,
  closeTime: raw.closeTime,
  timeLabel: `${format12h(raw.openTime)} – ${format12h(raw.closeTime)}`,
  icon: iconForAmenity(raw.name),
});

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

const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  pushEnabled: true,
  smsEnabled: false,
  staffEnabled: true,
};

// The backend stores alertPreferences as a free-form JSON blob (Resident.alertPreferences)
// — merge onto defaults so keys never previously saved still get a sane value.
const mapAlertPreferences = (raw: any): AlertPreferences => ({
  ...DEFAULT_ALERT_PREFERENCES,
  ...(raw && typeof raw === 'object' ? raw : {}),
});

type DataContextType = {
  passes: Pass[];
  fetchPasses: () => Promise<void>;
  createPass: (data: Partial<Pass>) => Promise<void>;
  suspendPass: (id: string) => Promise<void>;
  revokePass: (id: string) => Promise<void>;
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  fetchAlerts: () => Promise<void>;
  claimVehicleAlert: (id: string) => Promise<void>;
  triggerDuressAlert: () => Promise<void>;
  entries: Entry[];
  fetchEntries: () => Promise<void>;
  entriesLastFetchedAt: React.MutableRefObject<number>;
  members: Member[];
  fetchMembers: () => Promise<void>;
  addMember: (name: string, phone: string) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  amenities: Amenity[];
  fetchAmenities: () => Promise<void>;
  amenitiesLastFetchedAt: React.MutableRefObject<number>;
  bookAmenity: (amenityId: string, date: Date, startTime: string, endTime: string) => Promise<void>;
  scanRequests: ScanRequest[];
  addScanRequest: (request: ScanRequest) => void;
  pendingWalkIns: PendingWalkIn[];
  respondWalkIn: (id: string, status: 'APPROVED' | 'DENIED') => Promise<void>;
  emergencyContacts: EmergencyContact[];
  updateEmergencyContact: (name: string, phone: string) => Promise<void>;
  clearEmergencyContact: () => Promise<void>;
  alertPreferences: AlertPreferences;
  updateAlertPreferences: (prefs: Partial<AlertPreferences>) => Promise<void>;
  showUnitInCommunity: boolean;
  updateShowUnitInCommunity: (value: boolean) => Promise<void>;
  fetchProfileSettings: () => Promise<void>;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [scanRequests, setScanRequests] = useState<ScanRequest[]>([]);
  const [pendingWalkIns, setPendingWalkIns] = useState<PendingWalkIn[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [alertPreferences, setAlertPreferences] = useState<AlertPreferences>(DEFAULT_ALERT_PREFERENCES);
  const [showUnitInCommunity, setShowUnitInCommunity] = useState<boolean>(true);

  const { isAuthenticated, userRole } = useAuth();
  const socket = useSocket();

  // Mirrors `alerts` for read-only use inside callbacks that must stay
  // referentially stable (empty useCallback deps) — e.g. markAllAlertsRead,
  // which otherwise would need `alerts` as a dep and get a new identity on
  // every socket-pushed alert, breaking the DataContext.Provider memoization.
  const alertsRef = useRef<Alert[]>(alerts);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);

  const entriesLastFetchedAt = useRef(0);
  const amenitiesLastFetchedAt = useRef(0);

  const fetchPasses = useCallback(async () => {
    try {
      const response = await api.get('/passes');
      const raw: any[] = response.data.data ?? [];
      setPasses(raw.map(mapPass));
    } catch (error) {
      console.error('Failed to fetch passes:', error);
    }
  }, []);

  const createPass = useCallback(async (data: Partial<Pass>) => {
    try {
      const response = await api.post('/passes', data);
      const newPass = mapPass(response.data.data.pass);
      setPasses((prev) => [newPass, ...prev]);
    } catch (error) {
      console.error('Failed to create pass:', error);
      throw error;
    }
  }, []);

  const suspendPass = useCallback(async (id: string) => {
    const response = await api.put(`/passes/${id}/suspend`);
    const updated = mapPass(response.data.data);
    setPasses((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const revokePass = useCallback(async (id: string) => {
    const response = await api.put(`/passes/${id}/revoke`);
    const updated = mapPass(response.data.data);
    setPasses((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await api.get('/alerts');
      const raw: any[] = response.data.data ?? [];
      setAlerts(raw.map(mapAlert));
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  }, []);

  const addAlert = useCallback((alert: Alert) => setAlerts((prev) => [alert, ...prev]), []);

  const markAlertRead = useCallback(async (id: string) => {
    setAlerts((prev) => prev.map(a => a.id === id ? { ...a, unread: false } : a));
    try {
      await api.put(`/alerts/${id}/acknowledge`);
    } catch (e) { console.error('Failed to acknowledge alert:', e); }
  }, []);

  const markAllAlertsRead = useCallback(async () => {
    const unreadIds = alertsRef.current.filter(a => a.unread).map(a => a.id);
    setAlerts((prev) => prev.map(a => ({ ...a, unread: false })));
    try {
      await Promise.all(unreadIds.map(id => api.put(`/alerts/${id}/acknowledge`)));
    } catch (e) { console.error('Failed to acknowledge all alerts:', e); }
  }, []);

  const claimVehicleAlert = useCallback(async (id: string) => {
    const response = await api.post(`/alerts/${id}/claim`);
    const updated = mapAlert(response.data.data);
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }, []);

  const triggerDuressAlert = useCallback(async () => {
    await api.post('/alerts/duress', {});
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const response = await api.get('/entries');
      const raw: any[] = response.data.data ?? [];
      setEntries(raw.map(mapEntry));
      entriesLastFetchedAt.current = Date.now();
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      const response = await api.get('/residents/unit');
      const raw: any[] = response.data.data ?? [];
      setMembers(raw.map(mapMember).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)));
    } catch (error) {
      console.error('Failed to fetch household members:', error);
    }
  }, []);

  const addMember = useCallback(async (name: string, phone: string) => {
    await api.post('/residents/unit/members', { name, phone });
    await fetchMembers();
  }, [fetchMembers]);

  const deleteMember = useCallback(async (id: string) => {
    await api.delete(`/residents/unit/members/${id}`);
    setMembers((prev) => prev.filter(m => m.id !== id));
  }, []);

  const fetchAmenities = useCallback(async () => {
    try {
      const response = await api.get('/amenities');
      const raw: any[] = response.data.data ?? [];
      setAmenities(raw.map(mapAmenity));
      amenitiesLastFetchedAt.current = Date.now();
    } catch (error) {
      console.error('Failed to fetch amenities:', error);
    }
  }, []);

  const bookAmenity = useCallback(async (amenityId: string, date: Date, startTime: string, endTime: string) => {
    await api.post('/amenities/book', {
      amenityId,
      date: date.toISOString(),
      startTime,
      endTime,
    });
  }, []);

  const addScanRequest = useCallback((request: ScanRequest) => setScanRequests((prev) => [request, ...prev]), []);

  const respondWalkIn = useCallback(async (id: string, status: 'APPROVED' | 'DENIED') => {
    setPendingWalkIns((prev) => prev.filter((w) => w.id !== id));
    markAlertRead(id);
    try {
      await api.post(`/walkins/${id}/respond`, { status });
      fetchEntries();
    } catch (err) {
      console.error('Failed to send walk-in response:', err);
      fetchAlerts();
      throw err;
    }
  }, [markAlertRead, fetchEntries, fetchAlerts]);

  // The backend only stores a single emergency contact on the Resident record
  // (emergencyContact/emergencyContactName) — exposed here as a 0-or-1-item
  // array so existing read-only consumers (e.g. HomeScreen's SOS summary)
  // keep working unchanged.
  const fetchProfileSettings = useCallback(async () => {
    try {
      const response = await api.get('/residents/me');
      const resident = response.data.data;
      setAlertPreferences(mapAlertPreferences(resident?.alertPreferences));
      setShowUnitInCommunity(resident?.showUnitInCommunity ?? true);
      setEmergencyContacts(
        resident?.emergencyContact
          ? [{ id: resident.id, name: resident.emergencyContactName || 'Emergency contact', phone: resident.emergencyContact, relation: '' }]
          : []
      );
    } catch (error) {
      console.error('Failed to fetch profile settings:', error);
    }
  }, []);

  const updateEmergencyContact = useCallback(async (name: string, phone: string) => {
    const response = await api.put('/residents/me', { emergencyContactName: name, emergencyContact: phone });
    const resident = response.data.data;
    setEmergencyContacts([{ id: resident.id, name: resident.emergencyContactName, phone: resident.emergencyContact, relation: '' }]);
  }, []);

  const clearEmergencyContact = useCallback(async () => {
    await api.put('/residents/me', { emergencyContactName: '', emergencyContact: '' });
    setEmergencyContacts([]);
  }, []);

  const updateAlertPreferences = useCallback(async (prefs: Partial<AlertPreferences>) => {
    const merged = { ...alertPreferences, ...prefs };
    setAlertPreferences(merged);
    try {
      await api.put('/residents/me/alerts', { preferences: merged });
    } catch (error) {
      console.error('Failed to update alert preferences:', error);
      setAlertPreferences(alertPreferences);
      throw error;
    }
  }, [alertPreferences]);

  const updateShowUnitInCommunity = useCallback(async (value: boolean) => {
    const previous = showUnitInCommunity;
    setShowUnitInCommunity(value);
    try {
      await api.put('/residents/me', { showUnitInCommunity: value });
    } catch (error) {
      console.error('Failed to update privacy setting:', error);
      setShowUnitInCommunity(previous);
      throw error;
    }
  }, [showUnitInCommunity]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (userRole === 'RESIDENT') {
      Promise.allSettled([
        fetchPasses(),
        fetchAlerts(),
        fetchProfileSettings(),
        fetchEntries(),
        fetchMembers(),
        fetchAmenities(),
      ]);
    }
  }, [isAuthenticated, userRole, fetchPasses, fetchAlerts, fetchProfileSettings, fetchEntries, fetchMembers, fetchAmenities]);

  // Guard-initiated walk-in requests arrive over the resident's `unit_{id}`
  // socket room (see api-server socket.handler.ts) — surface them as a real
  // Alert + local notification so AlertsScreen's existing tap-through to
  // WalkInApproval works with a real backend entry id, not a client-faked one.
  useEffect(() => {
    if (!socket) return;

    // Re-fetch persisted alerts on (re)connect so nothing is missed if the
    // socket was briefly disconnected while a walk-in was submitted.
    const handleConnect = () => {
      fetchAlerts();
    };

    // Walk-in request emitted directly to the unit room by walkin.controller.ts.
    const handleWalkinRequest = (payload: { entryId: string; visitorName: string; purpose?: string; vehicleNumber?: string | null; gatePhotoUrl?: string }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setPendingWalkIns((prev) => [{ id: payload.entryId, visitorName: payload.visitorName, purpose: payload.purpose, vehicleNumber: payload.vehicleNumber, gatePhotoUrl: payload.gatePhotoUrl, time }, ...prev]);
      addAlert({
        id: payload.entryId,
        entryId: payload.entryId,
        title: 'Walk-in approval requested',
        subtitle: payload.purpose ? `Guard requested entry for ${payload.visitorName} — ${payload.purpose}` : `Guard requested entry for ${payload.visitorName}`,
        time,
        icon: '🔔',
        unread: true,
        imageUrl: payload.gatePhotoUrl,
      });
      scheduleLocalNotification('Walk-in approval requested', `Guard requested entry for ${payload.visitorName}`);
    };

    // DB-persisted alerts emitted by triggerAlert() to the user's personal room.
    // This is the reliable path for walk-ins, vehicle alerts, and any other
    // server-side triggered alert — independent of whether the unit room event fired.
    const handleNewAlert = (raw: any) => {
      const alert = mapAlert(raw);
      // Avoid duplicates if walkin_request already added it by the same entryId
      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === alert.id);
        return exists ? prev : [alert, ...prev];
      });
      // Also surface as a pending walk-in if it has an entryId and isn't already pending
      if (raw.entryId) {
        setPendingWalkIns((prev) => {
          const exists = prev.some((w) => w.id === raw.entryId);
          if (exists) return prev;
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return [{ id: raw.entryId, visitorName: raw.title, purpose: raw.body, gatePhotoUrl: raw.imageUrl, time }, ...prev];
        });
      }
      scheduleLocalNotification(raw.title, raw.body);
    };

    // QR-scan arrivals — same shape/handling as a manual walk-in request,
    // plus the extra pass-derived fields and a real server timeoutAt.
    const handleVisitorApprovalRequest = (payload: {
      entryId: string; visitorName: string; purpose?: string; visitorPhoto?: string | null;
      vehicleNumber?: string | null; expectedTime?: string | null; apartment?: string | null;
      tower?: string | null; gateName?: string | null; timeoutAt: string;
    }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setPendingWalkIns((prev) => [{
        id: payload.entryId,
        visitorName: payload.visitorName,
        purpose: payload.purpose,
        gatePhotoUrl: payload.visitorPhoto ?? undefined,
        time,
        timeoutAt: payload.timeoutAt,
        visitorPhoto: payload.visitorPhoto,
        vehicleNumber: payload.vehicleNumber,
        expectedTime: payload.expectedTime,
        apartment: payload.apartment,
        tower: payload.tower,
        gateName: payload.gateName,
      }, ...prev]);
      addAlert({
        id: payload.entryId,
        entryId: payload.entryId,
        title: 'Visitor scanned in at the gate',
        subtitle: `${payload.visitorName} is waiting — respond within 2 minutes`,
        time,
        icon: '🔔',
        unread: true,
        imageUrl: payload.visitorPhoto ?? undefined,
      });
      scheduleLocalNotification('Visitor scanned in at the gate', `${payload.visitorName} is waiting — respond within 2 minutes`);
    };

    const handleVisitorApprovalTimeout = (payload: { entryId: string }) => {
      setPendingWalkIns((prev) => prev.filter((w) => w.id !== payload.entryId));
      markAlertRead(payload.entryId);
    };

    socket.on('connect', handleConnect);
    socket.on('walkin_request', handleWalkinRequest);
    socket.on('new_alert', handleNewAlert);
    socket.on('visitor_approval_request', handleVisitorApprovalRequest);
    socket.on('visitor_approval_timeout', handleVisitorApprovalTimeout);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('walkin_request', handleWalkinRequest);
      socket.off('new_alert', handleNewAlert);
      socket.off('visitor_approval_request', handleVisitorApprovalRequest);
      socket.off('visitor_approval_timeout', handleVisitorApprovalTimeout);
    };
  }, [socket, fetchAlerts, addAlert, markAlertRead]);

  const value = useMemo<DataContextType>(() => ({
    passes, fetchPasses, createPass, suspendPass, revokePass,
    alerts, addAlert, markAlertRead, markAllAlertsRead, fetchAlerts, claimVehicleAlert, triggerDuressAlert,
    entries, fetchEntries, entriesLastFetchedAt,
    members, fetchMembers, addMember, deleteMember,
    amenities, fetchAmenities, amenitiesLastFetchedAt, bookAmenity,
    scanRequests, addScanRequest,
    pendingWalkIns, respondWalkIn,
    emergencyContacts, updateEmergencyContact, clearEmergencyContact,
    alertPreferences, updateAlertPreferences,
    showUnitInCommunity, updateShowUnitInCommunity,
    fetchProfileSettings,
  }), [
    passes, fetchPasses, createPass, suspendPass, revokePass,
    alerts, addAlert, markAlertRead, markAllAlertsRead, fetchAlerts, claimVehicleAlert, triggerDuressAlert,
    entries, fetchEntries,
    members, fetchMembers, addMember, deleteMember,
    amenities, fetchAmenities, bookAmenity,
    scanRequests, addScanRequest,
    pendingWalkIns, respondWalkIn,
    emergencyContacts, updateEmergencyContact, clearEmergencyContact,
    alertPreferences, updateAlertPreferences,
    showUnitInCommunity, updateShowUnitInCommunity,
    fetchProfileSettings,
  ]);

  return <DataContext.Provider value={value}>{children}  </DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
