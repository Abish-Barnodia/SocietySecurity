import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

const MEDIA_LABEL: Record<string, { icon: string; label: string }> = {
  IMAGE: { icon: 'photo', label: 'Photo' },
  VIDEO: { icon: 'video', label: 'Video' },
  AUDIO: { icon: 'microphone-2', label: 'Voice note' },
  FILE: { icon: 'paperclip', label: 'File' },
};

const senderLabel = (sender: any) => {
  const resident = sender?.resident;
  const name = resident?.name ?? sender?.manager?.name ?? sender?.role ?? 'Unknown';
  const unit = resident?.unit ? `${resident.unit.tower ? resident.unit.tower + ' ' : ''}${resident.unit.unitNumber}` : null;
  return unit ? `${name} · ${unit}` : name;
};

function FeedTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/community/messages`, { headers: authHeaders() });
      const data = await res.json();
      setMessages(data.data?.messages || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/community/messages`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'TEXT', body }),
      });
      setDraft('');
      await load();
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/community/messages/${id}`, { method: 'DELETE', headers: authHeaders() });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const composer = (
    <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
      <input
        type="text"
        className="form-input"
        placeholder="Message the community feed as Admin Manager…"
        style={{ flex: 1 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
      />
      <button className="btn btn-primary" onClick={send} disabled={sending || !draft.trim()}>
        <Icon name="send" size={14} /> Send
      </button>
    </div>
  );

  if (loading) return <div>{composer}<div className="card">Loading feed…</div></div>;
  if (messages.length === 0) {
    return <div>{composer}<div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No messages in the community feed yet.</div></div>;
  }

  return (
    <div>
      {composer}
      {messages.map((m: any) => (
        <div key={m.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="feed-title">{senderLabel(m.sender)}</div>
              <div className="feed-time">
                {new Date(m.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
            <button
              className="action-btn"
              onClick={() => handleDelete(m.id)}
              disabled={deletingId === m.id}
              title="Remove message"
            >
              <Icon name="trash" size={14} />
            </button>
          </div>

          {m.type === 'TEXT' && (
            <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--text-main)' }}>{m.body}</p>
          )}

          {m.type === 'POLL' && m.poll && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{m.poll.question}</p>
              {m.poll.options.map((o: any) => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}>
                  <span>{o.text}</span>
                  <span>{o.votes.length} vote{o.votes.length === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          )}

          {m.type !== 'TEXT' && m.type !== 'POLL' && (
            <a href={m.mediaUrl ?? '#'} target="_blank" rel="noreferrer" className="feed-meta-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, textDecoration: 'none' }}>
              {MEDIA_LABEL[m.type] ? (<><Icon name={MEDIA_LABEL[m.type].icon} size={12} /> {MEDIA_LABEL[m.type].label}</>) : m.type}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function MembersTab() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`${API_BASE}/community/members/manage`, { headers: authHeaders() });
    const data = await res.json();
    setMembers(data.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleMute = async (m: any) => {
    setTogglingId(m.id);
    const muted = !m.muted;
    try {
      await fetch(`${API_BASE}/community/members/${m.id}/mute`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted }),
      });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, muted } : x)));
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) return <div className="card">Loading members…</div>;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr className="table-header-row">
            {['Member', 'Unit', 'Role', 'Joined', 'Posts', 'Chat', 'Status'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 16px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m: any) => (
            <tr key={m.id} className="table-row">
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.name}</td>
              <td style={{ padding: '12px 16px' }}>{m.unit ? `${m.unit.tower ? m.unit.tower + ' ' : ''}${m.unit.unitNumber}` : '—'}</td>
              <td style={{ padding: '12px 16px' }}><span className="feed-meta-badge">{m.role}</span></td>
              <td style={{ padding: '12px 16px' }}>{new Date(m.joinedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td style={{ padding: '12px 16px' }}>{m.postCount}</td>
              <td style={{ padding: '12px 16px' }}>
                <button
                  onClick={() => toggleMute(m)}
                  disabled={togglingId === m.id}
                  title={m.muted ? 'Muted — click to allow posting' : 'Can post — click to mute'}
                  style={{
                    width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: m.muted ? '#CBD5E1' : 'var(--primary)', position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: m.muted ? 2 : 18, width: 16, height: 16,
                    borderRadius: '50%', background: 'white', transition: 'left 0.15s ease',
                  }} />
                </button>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span className={`status-badge-modern ${m.muted ? 'status-offline-modern' : 'status-on-post-modern'}`}>
                  {m.muted ? 'muted' : 'active'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlaggedTab() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`${API_BASE}/community/reports`, { headers: authHeaders() });
    const data = await res.json();
    setReports(data.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const dismiss = async (r: any) => {
    setBusyId(r.id);
    try {
      await fetch(`${API_BASE}/community/reports/${r.id}/dismiss`, { method: 'POST', headers: authHeaders() });
      setReports((prev) => prev.filter((x) => x.id !== r.id));
    } finally {
      setBusyId(null);
    }
  };

  const removeMessage = async (r: any) => {
    setBusyId(r.id);
    try {
      await fetch(`${API_BASE}/community/messages/${r.message.id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {});
      await fetch(`${API_BASE}/community/reports/${r.id}/resolve`, { method: 'POST', headers: authHeaders() });
      setReports((prev) => prev.filter((x) => x.id !== r.id));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="card">Loading flagged content…</div>;
  if (reports.length === 0) {
    return <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No pending reports. The community feed is clean.</div>;
  }

  return (
    <div>
      {reports.map((r: any) => (
        <div key={r.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{senderLabel(r.message?.sender)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Flagged by {r.reporter?.resident?.name ?? 'a resident'} on {new Date(r.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
            <span className="status-badge status-overdue">pending</span>
          </div>

          <p style={{ fontSize: 13.5, margin: '12px 0 6px' }}><strong>Reason:</strong> {r.reason}</p>
          {r.message?.body && <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 12px' }}>"{r.message.body}"</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => dismiss(r)} disabled={busyId === r.id}>Dismiss</button>
            <button className="btn" style={{ background: 'var(--danger)', color: 'white' }} onClick={() => removeMessage(r)} disabled={busyId === r.id}>
              Delete Message
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const CommunityControl: React.FC = () => {
  const [tab, setTab] = useState<'feed' | 'members' | 'flagged'>('feed');

  const tabs: { key: typeof tab; label: string; icon: React.ReactNode }[] = [
    { key: 'feed', label: 'Community Feed', icon: <Icon name="message" size={15} /> },
    { key: 'members', label: 'Members', icon: <Icon name="users" size={15} /> },
    { key: 'flagged', label: 'Flagged Content', icon: <Icon name="flag" size={15} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ fontSize: 24 }}>Community Control</h1>
        <p className="page-subtitle">Community feed moderation, member management, flagged content review, and chat toggle administration</p>
      </div>

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 24, background: '#F1F5F9', padding: 4, borderRadius: 8 }}>
        {tabs.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'feed' && <FeedTab />}
      {tab === 'members' && <MembersTab />}
      {tab === 'flagged' && <FlaggedTab />}
    </div>
  );
};

export default CommunityControl;
