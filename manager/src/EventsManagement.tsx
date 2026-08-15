import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  UPCOMING: { bg: '#DCFCE7', text: '#15803D' },
  ONGOING: { bg: '#E0F2FE', text: '#0369A1' },
  COMPLETED: { bg: '#F1F5F9', text: '#64748B' },
  CANCELLED: { bg: '#FEE2E2', text: '#991B1B' },
};

const formatRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${startTime} - ${endTime}`;
};

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time, not a full ISO string.
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EMPTY_FORM = { title: '', description: '', location: '', startDate: '', endDate: '', status: 'UPCOMING' };

const EventsManagement: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/events`, { headers: authHeaders() });
      const data = await res.json();
      if (data.status === 'success') setEvents(data.data);
    } catch (err) {
      console.error('Failed to fetch events', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (ev: any) => {
    setEditId(ev.id);
    setForm({
      title: ev.title, description: ev.description, location: ev.location || '',
      startDate: toLocalInput(ev.startDate), endDate: toLocalInput(ev.endDate), status: ev.status,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.startDate || !form.endDate) return;
    setSaving(true);
    try {
      const url = editId ? `${API_BASE}/events/${editId}` : `${API_BASE}/events`;
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
        }),
      });
      if (res.ok) {
        setIsFormOpen(false);
        fetchEvents();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, flex: 1, backgroundColor: 'var(--bg-secondary)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Events</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Create and manage community events residents can RSVP to</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={openCreate}>
          <Icon name="plus" size={16} /> Create Event
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : events.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No events yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {events.map(ev => {
            const s = STATUS_STYLE[ev.status] || STATUS_STYLE.UPCOMING;
            return (
              <div key={ev.id} style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{ev.title}</h3>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: s.bg, color: s.text }}>{ev.status.toLowerCase()}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{formatRange(ev.startDate, ev.endDate)}</div>
                {ev.location && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}><Icon name="map-pin" size={13} /> {ev.location}</div>}
                <p style={{ fontSize: 13, color: 'var(--text-main)', margin: '0 0 14px 0' }}>{ev.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev._count?.rsvps ?? 0} going</span>
                  <button
                    onClick={() => openEdit(ev)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 6, cursor: 'pointer' }}>
                    <Icon name="pencil" size={13} /> Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editId ? 'Edit Event' : 'Create Event'}</h3>
                <p className="modal-subtitle">Residents see this and can RSVP from the resident app</p>
              </div>
              <button className="modal-close" onClick={() => setIsFormOpen(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Title</label>
                <input type="text" className="form-input" placeholder="e.g. Diwali Celebration"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea className="form-input" style={{ height: 80, resize: 'none' }}
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Location</label>
                <input type="text" className="form-input" placeholder="e.g. Clubhouse"
                  value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="form-row">
                <div>
                  <label className="form-label">Starts</label>
                  <input type="datetime-local" className="form-input" value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Ends</label>
                  <input type="datetime-local" className="form-input" value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="UPCOMING">Upcoming</option>
                  <option value="ONGOING">Ongoing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsFormOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsManagement;
