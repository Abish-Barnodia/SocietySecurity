import { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

const NOTIFICATION_OPTIONS = [
  { key: 'emailAlerts', label: 'Email alerts', description: 'Security alerts and escalations sent to your email' },
  { key: 'pushAlerts', label: 'Push notifications', description: 'Real-time alerts on this device' },
  { key: 'paymentAlerts', label: 'Payment updates', description: 'Notify when a resident completes a maintenance payment' },
  { key: 'dailyDigest', label: 'Daily digest', description: 'Summary of the day\'s activity every evening' },
];

function SecurityTab({ email }: { email: string }) {
  const [step, setStep] = useState<'idle' | 'otp-sent'>('idle');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const requestCode = async () => {
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { setStep('otp-sent'); setMessage({ text: 'Code sent to your email.' }); }
      else setMessage({ text: 'Could not send code. Try again.', error: true });
    } finally {
      setSending(false);
    }
  };

  const confirmChange = async () => {
    if (code.length !== 6 || newPassword.length < 6) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: 'Password updated successfully.' });
        setStep('idle'); setCode(''); setNewPassword('');
      } else {
        setMessage({ text: data.message || 'Invalid or expired code.', error: true });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 420 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Change Password</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        We'll email a 6-digit code to your account email to confirm the change.
      </p>

      {step === 'idle' ? (
        <button className="btn btn-primary" onClick={requestCode} disabled={sending}>
          {sending ? 'Sending...' : 'Send verification code'}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="form-label">6-digit code</label>
            <input type="text" className="form-input" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
          </div>
          <div>
            <label className="form-label">New password</label>
            <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => { setStep('idle'); setCode(''); setNewPassword(''); setMessage(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={confirmChange} disabled={saving || code.length !== 6 || newPassword.length < 6}>
              {saving ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p style={{ marginTop: 14, fontSize: 13, color: message.error ? '#991B1B' : '#15803D' }}>{message.text}</p>
      )}
    </div>
  );
}

function NotificationsTab({ initial }: { initial: Record<string, boolean> }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ emailAlerts: true, pushAlerts: true, paymentAlerts: true, dailyDigest: false, ...initial });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = async (key: string) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API_BASE}/auth/me/alerts`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: updated }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NOTIFICATION_OPTIONS.map(opt => (
          <div key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.description}</div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, flexShrink: 0, marginLeft: 16 }}>
              <input type="checkbox" checked={!!prefs[opt.key]} onChange={() => toggle(opt.key)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', inset: 0, borderRadius: 22, cursor: 'pointer', transition: 'background 0.15s',
                backgroundColor: prefs[opt.key] ? 'var(--primary)' : '#CBD5E1',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: prefs[opt.key] ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
                  backgroundColor: 'white', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }} />
              </span>
            </label>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 14, fontSize: 12, color: saving ? 'var(--text-muted)' : '#15803D', minHeight: 16 }}>
        {saving ? 'Saving...' : saved ? 'Saved' : ''}
      </p>
    </div>
  );
}

const ManagerProfile = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'general' | 'security' | 'notifications'>('general');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          setProfile(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="card">Loading profile...</div>;
  if (!profile) return <div className="card">Error loading profile data.</div>;

  const managerData = profile.manager || {};
  const propertyName = managerData.property?.name || 'No Property Assigned';

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account, security settings, and preferences</p>
        </div>
        <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Edit Profile
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Icon name="user" size={48} />
          </div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>{managerData.name || 'Admin'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>{profile.role === 'MANAGER' ? 'Facility Manager' : profile.role}</p>
          <p style={{ color: 'var(--text-sidebar)', fontSize: 13, marginBottom: 16 }}>{propertyName}</p>
          
          <div style={{ padding: '6px 12px', background: '#E6FBF5', color: '#00A676', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00A676' }}></span> Online
          </div>

          <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', margin: '24px 0 16px' }}></div>
          
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Role Status</span>
              <span style={{ fontWeight: 500 }}>{profile.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Member since</span>
              <span style={{ fontWeight: 500 }}>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 24 }}>
            <button className={`tab-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}><Icon name="user" size={16} /> General</button>
            <button className={`tab-btn ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}><Icon name="shield" size={16} /> Security</button>
            <button className={`tab-btn ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')}><Icon name="bell" size={16} /> Notifications</button>
          </div>

          {tab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Full Name</label>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{managerData.name || 'N/A'}</div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Role</label>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{profile.role === 'MANAGER' ? 'Facility Manager' : profile.role}</div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Email</label>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{profile.email || 'N/A'}</div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Phone</label>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{profile.phone || 'N/A'}</div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>Assigned Property</label>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{propertyName}</div>
              </div>
            </div>
          )}

          {tab === 'security' && <SecurityTab email={profile.email} />}
          {tab === 'notifications' && <NotificationsTab initial={managerData.alertPreferences || {}} />}
        </div>
      </div>
    </div>
  );
};

export default ManagerProfile;
