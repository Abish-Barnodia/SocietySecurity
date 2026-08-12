import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

const formatAmount = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const EMPTY_FORM = { amount: '', type: 'INCOME', category: '', description: '', date: new Date().toISOString().split('T')[0] };

const FundManagement: React.FC = () => {
  const [summary, setSummary] = useState<{ balance: number; totalIncome: number; totalExpenses: number; transactions: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/funds/summary`, { headers: authHeaders() });
      const data = await res.json();
      if (data.status === 'success') setSummary(data.data);
    } catch (err) {
      console.error('Failed to fetch fund summary', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0 || !form.description.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/funds/transactions`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setIsFormOpen(false);
        fetchSummary();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, flex: 1, backgroundColor: 'var(--bg-secondary)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Fund Management</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Track society fund income, expenses, and the running balance</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={openCreate}>
          <Icon name="plus" size={16} /> Add Transaction
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#E6FBF5', color: '#00A676' }}><Icon name="wallet" size={16} /></div>
              <div className="stat-value">{formatAmount(summary.balance)}</div>
              <div className="stat-title">Fund Balance</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}><Icon name="arrow-down" size={16} /></div>
              <div className="stat-value">{formatAmount(summary.totalIncome)}</div>
              <div className="stat-title">Total Income</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}><Icon name="arrow-up" size={16} /></div>
              <div className="stat-value">{formatAmount(summary.totalExpenses)}</div>
              <div className="stat-title">Total Expenses</div>
            </div>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Ledger</h3>
          <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="table-header-row">
                  {['Description', 'Category', 'Date', 'Amount'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.transactions.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No transactions recorded yet.</td></tr>
                ) : summary.transactions.map((t: any) => {
                  const isIncome = t.type === 'INCOME';
                  return (
                    <tr key={t.id} className="table-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px', fontSize: 13 }}>{t.description || '—'}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{t.category || '—'}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{formatDate(t.date)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: isIncome ? '#15803D' : '#991B1B' }}>
                        {isIncome ? '+' : '-'}{formatAmount(t.amount)}
                      </td>
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add Transaction</h3>
                <p className="modal-subtitle">Updates the fund balance residents see</p>
              </div>
              <button className="modal-close" onClick={() => setIsFormOpen(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-row">
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount (₹)</label>
                  <input type="number" min={0} className="form-input" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Description</label>
                <input type="text" className="form-input" placeholder="e.g. Security guard salary"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-row">
                <div>
                  <label className="form-label">Category</label>
                  <input type="text" className="form-input" placeholder="e.g. Salaries"
                    value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsFormOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Add Transaction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundManagement;
