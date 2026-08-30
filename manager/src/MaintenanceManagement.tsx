import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Icon from './Icon';
import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });
const SOCKET_URL = API_BASE.replace(/\/api\/v1\/?$/, '');

interface Payment {
  id: string;
  amount: number;
  method: string;
  transactionId: string | null;
  razorpayOrderId: string | null;
  status: string;
  paidAt: string;
}

interface Invoice {
  id: string;
  unitId: string;
  residentId: string | null;
  amount: number;
  description: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt: string | null;
  unit: { unitNumber: string; tower: string | null } | null;
  resident: { name: string } | null;
  payments: Payment[];
}

interface Family {
  unitId: string;
  apartmentNumber: string;
  tower: string;
  primaryResident: { id: string; name: string } | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PAID: { bg: '#DCFCE7', text: '#15803D' },
  PENDING: { bg: '#FEF3C7', text: '#B45309' },
  OVERDUE: { bg: '#FEE2E2', text: '#991B1B' },
  CANCELLED: { bg: '#F1F5F9', text: '#64748B' },
  FAILED: { bg: '#FEE2E2', text: '#991B1B' },
};

const formatAmount = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Invoice.status only tracks PENDING/PAID/OVERDUE/CANCELLED; a failed
// Razorpay attempt lives on the Payment row instead. Blend the two into one
// status the table can filter and display on.
const effectiveStatus = (inv: Invoice): 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED' | 'FAILED' => {
  if (inv.status !== 'PENDING') return inv.status;
  const latestPayment = [...inv.payments].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];
  return latestPayment?.status === 'FAILED' ? 'FAILED' : 'PENDING';
};

const latestSuccessfulPayment = (inv: Invoice) => inv.payments.find((p) => p.status === 'SUCCESS');

const FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'OVERDUE', label: 'Overdue' },
];

const EMPTY_FORM = { description: '', amount: '', dueDate: '', targetAll: true, unitIds: [] as string[] };

const MaintenanceManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, famRes] = await Promise.all([
        fetch(`${API_BASE}/maintenance/invoices/all`, { headers: authHeaders() }),
        fetch(`${API_BASE}/residents`, { headers: authHeaders() }),
      ]);
      const invData = await invRes.json();
      if (invData.status === 'success') setInvoices(invData.data);
      const famData = await famRes.json();
      if (famData.status === 'success') setFamilies(famData.data);
    } catch (err) {
      console.error('Failed to fetch maintenance data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Live updates: a resident paying (or another manager tab raising a bill)
  // shows up here without a manual refresh — reuses the server's existing
  // Socket.io property-room broadcast, no separate real-time system.
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    const upsert = (raw: Invoice) => {
      setInvoices((prev) => (prev.some((i) => i.id === raw.id) ? prev.map((i) => (i.id === raw.id ? raw : i)) : [raw, ...prev]));
    };
    socket.on('invoice:new', upsert);
    socket.on('invoice:update', upsert);

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const toggleUnit = (unitId: string) => {
    setForm((f) => ({
      ...f,
      unitIds: f.unitIds.includes(unitId) ? f.unitIds.filter((id) => id !== unitId) : [...f.unitIds, unitId],
    }));
  };

  const handleSave = async () => {
    const unitIds = form.targetAll ? families.map((f) => f.unitId) : form.unitIds;
    if (!form.description.trim() || !form.amount || !form.dueDate || unitIds.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/maintenance/invoices`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: form.description, amount: form.amount, dueDate: form.dueDate, unitIds }),
      });
      if (res.ok) {
        setIsFormOpen(false);
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return invoices.filter((inv) => {
      const status = effectiveStatus(inv);
      if (filter !== 'ALL' && status !== filter) return false;
      if (!q) return true;
      const unitLabel = inv.unit ? `${inv.unit.tower ? inv.unit.tower + '-' : ''}${inv.unit.unitNumber}` : '';
      const txn = latestSuccessfulPayment(inv)?.transactionId || '';
      return (
        (inv.resident?.name || '').toLowerCase().includes(q) ||
        unitLabel.toLowerCase().includes(q) ||
        txn.toLowerCase().includes(q)
      );
    });
  }, [invoices, filter, search]);

  const summary = useMemo(() => {
    const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
    const collected = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);
    const pending = invoices
      .filter((i) => { const s = effectiveStatus(i); return s === 'PENDING' || s === 'OVERDUE'; })
      .reduce((s, i) => s + i.amount, 0);
    const paidCount = invoices.filter((i) => i.status === 'PAID').length;
    const pendingCount = invoices.filter((i) => { const s = effectiveStatus(i); return s === 'PENDING' || s === 'OVERDUE'; }).length;
    const failedCount = invoices.filter((i) => effectiveStatus(i) === 'FAILED').length;
    return { totalAmount, collected, pending, paidCount, pendingCount, failedCount };
  }, [invoices]);

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const header = ['Resident', 'Unit', 'Amount', 'Due Date', 'Status', 'Payment Date', 'Razorpay Payment ID', 'Razorpay Order ID', 'Transaction Reference'];
    const rows = filtered.map((inv) => {
      const paid = latestSuccessfulPayment(inv);
      const unitLabel = inv.unit ? `${inv.unit.tower ? inv.unit.tower + '-' : ''}${inv.unit.unitNumber}` : '';
      return [
        inv.resident?.name || '',
        unitLabel,
        inv.amount,
        formatDate(inv.dueDate),
        effectiveStatus(inv),
        paid ? formatDate(paid.paidAt) : '',
        paid?.transactionId || '',
        paid?.razorpayOrderId || '',
        paid?.id || '',
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `maintenance_payments_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24, flex: 1, backgroundColor: 'var(--bg-secondary)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Maintenance</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Raise maintenance bills and track resident payments in real time</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'white' }} onClick={handleExportCSV} disabled={filtered.length === 0}>
            <Icon name="download" size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={openCreate}>
            <Icon name="plus" size={16} /> Create Charge
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
            <div className="stat-card"><div className="stat-value">{formatAmount(summary.totalAmount)}</div><div className="stat-title">Total Amount</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#15803D' }}>{formatAmount(summary.collected)}</div><div className="stat-title">Collected</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#B45309' }}>{formatAmount(summary.pending)}</div><div className="stat-title">Pending</div></div>
            <div className="stat-card"><div className="stat-value">{summary.paidCount}</div><div className="stat-title"># Paid</div></div>
            <div className="stat-card"><div className="stat-value">{summary.pendingCount}</div><div className="stat-title"># Pending</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#991B1B' }}>{summary.failedCount}</div><div className="stat-title"># Failed</div></div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 4, borderRadius: 8 }}>
              {FILTERS.map((f) => (
                <button key={f.key} className={`tab-btn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
              ))}
            </div>
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input type="text" className="form-input" placeholder="Search resident, unit, or transaction ID..."
                style={{ paddingLeft: 36, backgroundColor: 'white' }}
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="table-header-row">
                  {['Resident', 'Unit', 'Amount', 'Due Date', 'Status', 'Payment Date', 'Transaction'].map((h) => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No charges match.</td></tr>
                ) : filtered.map((inv) => {
                  const status = effectiveStatus(inv);
                  const s = STATUS_STYLE[status] || STATUS_STYLE.PENDING;
                  const paid = latestSuccessfulPayment(inv);
                  return (
                    <tr key={inv.id} className="table-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600 }}>{inv.resident?.name || 'Unknown'}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{inv.unit ? `${inv.unit.tower ? inv.unit.tower + '-' : ''}${inv.unit.unitNumber}` : 'N/A'}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600 }}>{formatAmount(inv.amount)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(inv.dueDate)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: s.bg, color: s.text }}>{status.toLowerCase()}</span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{paid ? formatDate(paid.paidAt) : '—'}</td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{paid?.transactionId || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Create Maintenance Charge</h3>
                <p className="modal-subtitle">Residents pay this from the resident app via Razorpay</p>
              </div>
              <button className="modal-close" onClick={() => setIsFormOpen(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Description</label>
                <input type="text" className="form-input" placeholder="e.g. Monthly Maintenance Fee - August"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-row">
                <div>
                  <label className="form-label">Amount (₹)</label>
                  <input type="number" min={0} className="form-input" value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Target</label>
                <div style={{ display: 'flex', gap: 16, marginBottom: form.targetAll ? 0 : 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" checked={form.targetAll} onChange={() => setForm({ ...form, targetAll: true })} /> All residents ({families.length})
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" checked={!form.targetAll} onChange={() => setForm({ ...form, targetAll: false })} /> Specific units
                  </label>
                </div>
                {!form.targetAll && (
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: 10 }}>
                    {families.map((f) => (
                      <label key={f.unitId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.unitIds.includes(f.unitId)} onChange={() => toggleUnit(f.unitId)} />
                        {f.tower ? `${f.tower} - ` : ''}{f.apartmentNumber} ({f.primaryResident?.name || 'No primary resident'})
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsFormOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Charge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceManagement;
