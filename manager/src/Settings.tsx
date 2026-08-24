import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import PasswordInput from './PasswordInput';
import { API_BASE } from './config';

interface RoleSummary {
  id: string;
  title: string;
  count: number;
  desc: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
}

const DEFAULT_HARDWARE = { cctvIntegration: false, rfidScanners: false, boomBarrierAutoMode: false };
const DEFAULT_PLATFORM = { theme: 'light', timezone: 'Asia/Kolkata' };

const ROLE_ICON: Record<string, string> = { MANAGER: 'user-star', COMMITTEE: 'users-group', GUARD: 'shield-check', RESIDENT: 'home' };

// Mirrors the real manager-portal nav sections (App.tsx) and the backend's
// requireManagerPermission() gates — an empty selection means full access.
const PERMISSION_MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'guards', label: 'Guard Management' },
  { id: 'residents', label: 'Resident Directory' },
  { id: 'timeline', label: 'Event Timeline' },
  { id: 'alerts', label: 'Alerts & Escalation' },
  { id: 'expected', label: 'Expected Visitors' },
  { id: 'parking', label: 'Parking & Vehicles' },
  { id: 'reports', label: 'Reports' },
  { id: 'community', label: 'Community Control' },
  { id: 'workforce', label: 'Workforce Mgmt' },
  { id: 'events', label: 'Events' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'funds', label: 'Fund Management' },
  { id: 'settings', label: 'Settings' },
];

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

interface ManagerAccount {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
  isCurrentlyActive: boolean;
  sessionLoginAt: string | null;
  sessionLastActivityAt: string | null;
  sessionExpiresAt: string | null;
}

const EMPTY_MANAGER_FORM = { name: '', email: '', password: '', permissions: [] as string[] };

const formatDateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function ManageManagersTab() {
  const [managers, setManagers] = useState<ManagerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null); // manager id (or 'new'/'force-logout') mid-action

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagerAccount | null>(null);
  const [form, setForm] = useState(EMPTY_MANAGER_FORM);

  const [resetTarget, setResetTarget] = useState<ManagerAccount | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const [statusTarget, setStatusTarget] = useState<ManagerAccount | null>(null); // activate/deactivate confirm
  const [forceLogoutConfirm, setForceLogoutConfirm] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchManagers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/manager-accounts`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Failed to load managers');
      setManagers(data.data);
    } catch (e: any) {
      setLoadError(e.message || 'Could not load manager accounts. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchManagers(); }, []);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_MANAGER_FORM); setIsFormOpen(true); };
  const openEdit = (m: ManagerAccount) => { setEditTarget(m); setForm({ name: m.name, email: m.email, password: '', permissions: m.permissions }); setIsFormOpen(true); };

  const togglePermission = (id: string) => {
    setForm((f) => ({ ...f, permissions: f.permissions.includes(id) ? f.permissions.filter((p) => p !== id) : [...f.permissions, id] }));
  };

  const saveManager = async () => {
    if (!editTarget && (!form.name.trim() || !form.email.trim() || form.password.length < 6)) return;
    if (editTarget && !form.name.trim()) return;
    setBusyId('new');
    try {
      const url = editTarget ? `${API_BASE}/manager-accounts/${editTarget.id}` : `${API_BASE}/manager-accounts`;
      const body = editTarget
        ? { name: form.name, permissions: form.permissions }
        : { name: form.name, email: form.email, password: form.password, permissions: form.permissions };
      const res = await fetch(url, {
        method: editTarget ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Save failed');
      showToast(editTarget ? 'Manager updated' : 'Manager account created');
      setIsFormOpen(false);
      fetchManagers();
    } catch (e: any) {
      showToast(e.message || 'Could not save. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const submitResetPassword = async () => {
    if (!resetTarget || resetPassword.length < 6) return;
    setBusyId(resetTarget.id);
    try {
      const res = await fetch(`${API_BASE}/manager-accounts/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Reset failed');
      showToast('Password reset');
      setResetTarget(null);
      setResetPassword('');
    } catch (e: any) {
      showToast(e.message || 'Could not reset password. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    const action = statusTarget.isActive ? 'deactivate' : 'activate';
    setBusyId(statusTarget.id);
    try {
      const res = await fetch(`${API_BASE}/manager-accounts/${statusTarget.id}/${action}`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Action failed');
      showToast(statusTarget.isActive ? 'Manager deactivated' : 'Manager activated');
      setStatusTarget(null);
      fetchManagers();
    } catch (e: any) {
      showToast(e.message || 'Could not update status. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmForceLogout = async () => {
    setBusyId('force-logout');
    try {
      const res = await fetch(`${API_BASE}/manager-accounts/force-logout`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Force logout failed');
      showToast('Active session released');
      setForceLogoutConfirm(false);
      fetchManagers();
    } catch (e: any) {
      showToast(e.message || 'Could not release the session. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <Icon name="loader-2" className="spin" size={28} color="var(--primary)" />
        <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading manager accounts...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <Icon name="alert-triangle" size={28} color="var(--danger)" />
        <p style={{ margin: '12px 0 16px', color: 'var(--text-muted)' }}>{loadError}</p>
        <button className="btn btn-primary" onClick={fetchManagers}>Retry</button>
      </div>
    );
  }

  const activeManager = managers.find((m) => m.isCurrentlyActive) || null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h3 className="card-title" style={{ marginBottom: 4 }}>Manage Managers</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Only one manager can be signed in to the portal at a time. Additional accounts wait until the active one logs out or goes idle for 15 minutes.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>Add Manager</button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        margin: '16px 0', padding: '12px 16px', borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border-color)',
      }}>
        {activeManager ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
            <span><strong>{activeManager.name}</strong> is currently active — signed in {formatDateTime(activeManager.sessionLoginAt)}, last activity {formatDateTime(activeManager.sessionLastActivityAt)}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-color)', flexShrink: 0 }} />
            No manager currently active — the portal is free for the next login.
          </div>
        )}
        {activeManager && (
          <button className="btn btn-outline" style={{ flexShrink: 0 }} onClick={() => setForceLogoutConfirm(true)} disabled={busyId === 'force-logout'}>
            Force Logout Active Manager
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
        {managers.map((m) => {
          const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
          const permLabel = m.permissions.length === 0 ? 'Full Access' : `${m.permissions.length} module${m.permissions.length !== 1 ? 's' : ''}`;
          return (
            <div key={m.id} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'center',
              gap: 16,
              padding: '14px 18px',
              borderRadius: 10,
              border: `1px solid ${m.isCurrentlyActive ? 'var(--primary)' : 'var(--border-color)'}`,
              background: m.isCurrentlyActive ? 'var(--primary-bg)' : 'var(--bg-card, white)',
              boxShadow: m.isCurrentlyActive ? '0 0 0 1px var(--primary)' : '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.2s',
            }}>
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: m.isActive ? 'var(--primary)' : '#CBD5E1',
                color: 'white', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {initials}
              </div>

              {/* Info */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-main)' }}>{m.name}</span>
                  {m.isCurrentlyActive && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#DCFCE7', color: '#15803D' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                      Signed In
                    </span>
                  )}
                  {!m.isActive && (
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>Deactivated</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.email}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>Access:</span> {permLabel}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>Last login:</span> {formatDateTime(m.lastLoginAt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-outline" style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6 }} onClick={() => openEdit(m)}>Edit</button>
                <button className="btn btn-outline" style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6 }} onClick={() => { setResetTarget(m); setResetPassword(''); }}>Reset Password</button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, color: m.isActive ? 'var(--danger)' : 'var(--success)', borderColor: m.isActive ? 'var(--danger)' : 'var(--success)' }}
                  onClick={() => setStatusTarget(m)}
                >
                  {m.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          );
        })}
        {managers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 10 }}>
            No manager accounts yet. Click "Add Manager" to create the first one.
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editTarget ? 'Edit Manager' : 'Add Manager'}</h3>
                <p className="modal-subtitle">{editTarget ? 'Update name and section access' : 'Creates a separate login for this manager'}</p>
              </div>
              <button className="modal-close" onClick={() => setIsFormOpen(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '65vh', overflowY: 'auto' }}>
              <div>
                <label className="form-label">Name</label>
                <input type="text" className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              {!editTarget && (
                <div className="form-row">
                  <div>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Password</label>
                    <PasswordInput className="form-input" placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Section Access</label>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>Leave nothing checked for full access to every section.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
                  {PERMISSION_MODULES.map((mod) => (
                    <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.permissions.includes(mod.id)} onChange={() => togglePermission(mod.id)} />
                      {mod.label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsFormOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveManager} disabled={busyId === 'new'}>
                  {busyId === 'new' ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Reset Password</h3>
                <p className="modal-subtitle">For {resetTarget.name} ({resetTarget.email})</p>
              </div>
              <button className="modal-close" onClick={() => setResetTarget(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">New Password</label>
                <PasswordInput className="form-input" autoFocus placeholder="At least 6 characters" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setResetTarget(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitResetPassword} disabled={resetPassword.length < 6 || busyId === resetTarget.id}>
                  {busyId === resetTarget.id ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statusTarget && (
        <div className="modal-overlay" onClick={() => setStatusTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{statusTarget.isActive ? 'Deactivate Manager' : 'Activate Manager'}</h3>
                {statusTarget.isActive && <p className="modal-subtitle" style={{ color: 'var(--danger)' }}>They'll be signed out immediately and can't log back in until reactivated.</p>}
              </div>
              <button className="modal-close" onClick={() => setStatusTarget(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 20px 0', fontSize: 14 }}>
                {statusTarget.isActive ? `Deactivate "${statusTarget.name}"?` : `Reactivate "${statusTarget.name}"?`}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setStatusTarget(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, ...(statusTarget.isActive ? { backgroundColor: 'var(--danger)' } : {}) }}
                  onClick={confirmStatusChange}
                  disabled={busyId === statusTarget.id}
                >
                  {busyId === statusTarget.id ? 'Working...' : statusTarget.isActive ? 'Yes, Deactivate' : 'Yes, Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {forceLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setForceLogoutConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Force Logout Active Manager</h3>
                <p className="modal-subtitle" style={{ color: 'var(--danger)' }}>Ends the current session immediately.</p>
              </div>
              <button className="modal-close" onClick={() => setForceLogoutConfirm(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 20px 0', fontSize: 14 }}>Release the active Manager Portal session so another manager can sign in?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setForceLogoutConfirm(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--danger)' }} onClick={confirmForceLogout} disabled={busyId === 'force-logout'}>
                  {busyId === 'force-logout' ? 'Releasing...' : 'Yes, Force Logout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          backgroundColor: toast.type === 'error' ? '#FEE2E2' : '#DCFCE7',
          color: toast.type === 'error' ? '#991B1B' : '#166534',
          padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#86EFAC'}`,
          fontWeight: 500, fontSize: 14,
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Applies the manager's saved theme preference to the whole app immediately
// (also called from App.tsx on boot so the choice survives a refresh).
export const applyManagerTheme = (theme: string) => {
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  localStorage.setItem('managerTheme', theme);
};

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('roles');
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [hardware, setHardware] = useState(DEFAULT_HARDWARE);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isKeyFormOpen, setIsKeyFormOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [settingsRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE}/settings`, { headers: authHeaders() }),
        fetch(`${API_BASE}/settings/role-summary`, { headers: authHeaders() }),
      ]);
      const settingsData = await settingsRes.json();
      const rolesData = await rolesRes.json();
      if (!settingsRes.ok || settingsData.status !== 'success') throw new Error(settingsData.message || 'Failed to load settings');
      if (!rolesRes.ok || rolesData.status !== 'success') throw new Error(rolesData.message || 'Failed to load role summary');

      setHardware({ ...DEFAULT_HARDWARE, ...(settingsData.data.hardware || {}) });
      setApiKeys(settingsData.data.apiKeys || []);
      const loadedPlatform = { ...DEFAULT_PLATFORM, ...(settingsData.data.platform || {}) };
      applyManagerTheme(loadedPlatform.theme);
      setRoles(rolesData.data);
    } catch (e: any) {
      setLoadError(e.message || 'Could not load settings. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Persists one top-level settings key and only commits the local state
  // change once the server confirms the write — a failed save no longer
  // silently looks like a successful one.
  const saveSetting = async (key: string, value: any, onSuccess: () => void) => {
    setSavingKey(key);
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Save failed');
      onSuccess();
      showToast('Saved');
    } catch (e: any) {
      showToast(e.message || 'Could not save changes. Try again.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleHardware = (field: keyof typeof hardware) => {
    const updated = { ...hardware, [field]: !hardware[field] };
    saveSetting('hardware', updated, () => setHardware(updated));
  };


  const generateKey = () => {
    if (!newKeyName.trim()) return;
    const secret = crypto.randomUUID().replace(/-/g, '');
    const newKey: ApiKey = { id: crypto.randomUUID(), name: newKeyName.trim(), key: `sg_live_${secret.slice(0, 24)}` };
    const updated = [...apiKeys, newKey];
    saveSetting('apiKeys', updated, () => {
      setApiKeys(updated);
      setIsKeyFormOpen(false);
      setNewKeyName('');
    });
  };

  const revokeKey = () => {
    if (!revokeTarget) return;
    const updated = apiKeys.filter(k => k.id !== revokeTarget.id);
    saveSetting('apiKeys', updated, () => { setApiKeys(updated); setRevokeTarget(null); });
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <Icon name="loader-2" className="spin" size={28} color="var(--primary)" />
        <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading settings...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <Icon name="alert-triangle" size={28} color="var(--danger)" />
        <p style={{ margin: '12px 0 16px', color: 'var(--text-muted)' }}>{loadError}</p>
        <button className="btn btn-primary" onClick={fetchAll}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 24px 24px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Settings</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          Manager accounts, role access overview, hardware integration status, and API keys
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'managers', label: 'Manage Managers', icon: 'users-group' },
          { id: 'roles', label: 'Roles & Permissions', icon: 'shield' },
          { id: 'hardware', label: 'Hardware', icon: 'cpu' },
          { id: 'apiKeys', label: 'API Keys', icon: 'key' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            style={{ borderRadius: 20, border: activeTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent' }}
          >
            <Icon name={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'managers' && <ManageManagersTab />}

      {activeTab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
          {roles.map((role) => (
            <div key={role.id} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="stat-icon" style={{ marginBottom: 0 }}><Icon name={ROLE_ICON[role.id] || 'user'} size={16} /></div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>{role.title}</h3>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{role.count} {role.count === 1 ? 'member' : 'members'}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{role.desc}</p>
            </div>
          ))}
          {roles.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No roles found for this property.</p>
          )}
        </div>
      )}

      {activeTab === 'hardware' && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 4 }}>Hardware Device Management</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 13 }}>
            Saved to this property's configuration. No physical devices are connected yet — enabling a toggle here reserves the setting for when hardware integration ships.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {([
              ['cctvIntegration', 'CCTV AI Analytics Integration'],
              ['rfidScanners', 'UHF RFID Scanners (Resident Vehicles)'],
              ['boomBarrierAutoMode', 'Boom Barrier Auto-open'],
            ] as const).map(([field, label]) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: savingKey === 'hardware' ? 'wait' : 'pointer', opacity: savingKey === 'hardware' ? 0.6 : 1 }}>
                <input type="checkbox" checked={hardware[field]} disabled={savingKey === 'hardware'} onChange={() => toggleHardware(field)} />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'apiKeys' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <h3 className="card-title" style={{ marginBottom: 4 }}>API Keys</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                Saved for future third-party integrations — nothing in the app currently authenticates using these.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsKeyFormOpen(true)} disabled={savingKey === 'apiKeys'}>Generate New Key</button>
          </div>
          {apiKeys.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>No API keys yet. Generate one to get started.</p>
          ) : (
            <table className="table" style={{ marginTop: 16, width: '100%' }}>
              <thead>
                <tr><th>Name</th><th>Key</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td><code style={{ background: 'var(--bg-main)', padding: '4px 8px', borderRadius: 4 }}>{k.key}</code></td>
                    <td>
                      <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: 12 }} disabled={savingKey === 'apiKeys'} onClick={() => setRevokeTarget(k)}>Revoke</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {isKeyFormOpen && (
        <div className="modal-overlay" onClick={() => setIsKeyFormOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Generate API Key</h3>
                <p className="modal-subtitle">Give it a name so you can identify it later</p>
              </div>
              <button className="modal-close" onClick={() => setIsKeyFormOpen(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Key Name</label>
                <input type="text" className="form-input" autoFocus placeholder="e.g. Reporting Integration" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setIsKeyFormOpen(false); setNewKeyName(''); }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={generateKey} disabled={!newKeyName.trim() || savingKey === 'apiKeys'}>
                  {savingKey === 'apiKeys' ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {revokeTarget && (
        <div className="modal-overlay" onClick={() => setRevokeTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Revoke API Key</h3>
                <p className="modal-subtitle" style={{ color: 'var(--danger)' }}>This can't be undone.</p>
              </div>
              <button className="modal-close" onClick={() => setRevokeTarget(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 20px 0', fontSize: 14 }}>Revoke "{revokeTarget.name}"?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setRevokeTarget(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--danger)' }} onClick={revokeKey} disabled={savingKey === 'apiKeys'}>
                  {savingKey === 'apiKeys' ? 'Revoking...' : 'Yes, Revoke'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          backgroundColor: toast.type === 'error' ? '#FEE2E2' : '#DCFCE7',
          color: toast.type === 'error' ? '#991B1B' : '#166534',
          padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#86EFAC'}`,
          fontWeight: 500, fontSize: 14,
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Settings;
