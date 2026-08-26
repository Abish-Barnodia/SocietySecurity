import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import EmptyState from './EmptyState';
import GuardProfile from './GuardProfile';
import PasswordInput from './PasswordInput';
import { API_BASE } from './config';

const GuardManagement: React.FC = () => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';
  
  const [activeTab, setActiveTab] = useState<'roster' | 'live' | 'salary'>('roster');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [guards, setGuards] = useState<any[]>([]);
  const [guardSearch, setGuardSearch] = useState('');
  const [guardStatusFilter, setGuardStatusFilter] = useState('All Status');
  const [activeGuards, setActiveGuards] = useState<any[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [salaryMonthFilter, setSalaryMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [entryPoints, setEntryPoints] = useState<any[]>([]);

  const [selectedGuard, setSelectedGuard] = useState<any>(null);

  // Salary slip
  const [salarySlip, setSalarySlip] = useState<any>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryError, setSalaryError] = useState('');
  const [salaryPayingId, setSalaryPayingId] = useState<string | null>(null);
  // ponytail: editable overrides for base salary & deductions
  const [editBase, setEditBase] = useState<number | ''>('');
  const [editDed, setEditDed] = useState<number | ''>('');

  const [isAddGuardOpen, setIsAddGuardOpen] = useState(false);
  const [newGuardForm, setNewGuardForm] = useState({
    name: '', badgeId: '', phone: '', email: '', password: '', post: '', shift: 'morning', status: 'On Post', dateOfJoining: '', photoUrl: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [guardFormError, setGuardFormError] = useState('');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setNewGuardForm({ ...newGuardForm, photoUrl: url });
    }
  };

  const handleCreateGuard = async () => {
    if (!newGuardForm.email.trim()) { setGuardFormError('Email is required so the guard can log in to the guard app'); return; }
    if (newGuardForm.password.length < 6) { setGuardFormError('Password must be at least 6 characters'); return; }
    try {
      const response = await fetch(`${API_BASE}/guards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newGuardForm.name || 'Unknown Guard',
          phone: newGuardForm.phone || '0000000000',
          email: newGuardForm.email,
          password: newGuardForm.password,
          badgeNumber: newGuardForm.badgeId || `SEC-${Math.floor(Math.random() * 1000)}`,
          status: newGuardForm.status,
          shift: newGuardForm.shift,
          post: newGuardForm.post,
          dateOfJoining: newGuardForm.dateOfJoining,
          photoUrl: newGuardForm.photoUrl
        })
      });
      if (response.ok) {
        setIsAddGuardOpen(false);
        setGuardFormError('');
        setNewGuardForm({ name: '', badgeId: '', phone: '', email: '', password: '', post: '', shift: 'morning', status: 'On Post', dateOfJoining: '', photoUrl: '' });
        fetchData(); // refresh the directory
      } else {
        const errorData = await response.json();
        // Zod validation failures come back as errorData.errors (an array of
        // { path, message }) — errorData.message alone is just "Validation
        // Error" with no indication of which field, so surface both.
        const detail = Array.isArray(errorData.errors)
          ? errorData.errors.map((e: any) => `${e.path?.slice(1).join('.') || 'field'}: ${e.message}`).join('\n')
          : '';
        setGuardFormError(`Failed to create guard: ${errorData.message}${detail ? `\n${detail}` : ''}`);
      }
    } catch (err) {
      console.error(err);
      setGuardFormError('Error creating guard');
    }
  };

  const openSalaryModal = async (guard: any) => {
    setSalarySlip(null);
    setSalaryError('');
    setSalaryLoading(true);
    setEditBase('');
    setEditDed('');
    try {
      const res = await fetch(`${API_BASE}/guards/${guard.id}/salary`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSalarySlip(data.data);
        setEditBase(data.data.baseSalary ?? 15000);
        setEditDed(data.data.deductions ?? 0);
      } else {
        setSalaryError(data.message || 'Failed to load salary slip');
      }
    } catch (err) {
      setSalaryError('Network error');
    } finally {
      setSalaryLoading(false);
    }
  };

  const handlePaySalary = async () => {
    if (!salarySlip) return;
    if (salarySlip.status === 'PAID') { alert('Salary is already paid for this month.'); return; }

    setSalaryPayingId(salarySlip.id);
    try {
      // 1. Create Razorpay order
      const editedNet = Number(editBase || 0) - Number(editDed || 0);
      const orderRes = await fetch(`${API_BASE}/guards/salary/${salarySlip.id}/create-order`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrideAmount: editedNet })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { alert(orderData.message || 'Failed to create order'); setSalaryPayingId(null); return; }

      const { orderId, amount, currency, keyId } = orderData.data;

      // 2. Load Razorpay checkout SDK if not already loaded
      await new Promise<void>((resolve, reject) => {
        if ((window as any).Razorpay) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
        document.body.appendChild(script);
      });

      // 3. Open checkout
      const options = {
        key: keyId,
        amount,
        currency,
        name: 'SecureGate',
        description: `Salary Payment — ${salarySlip.guard.name} (${salarySlip.monthYear})`,
        order_id: orderId,
        handler: async (response: any) => {
          // 4. Verify server-side
          const verifyRes = await fetch(`${API_BASE}/guards/salary/${salarySlip.id}/verify`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.status === 'success') {
            setSalarySlip((prev: any) => ({ ...prev, status: 'PAID', paidAt: verifyData.data.paidAt, transactionId: verifyData.data.transactionId }));
          } else {
            alert('Payment verification failed: ' + (verifyData.message || 'Unknown error'));
          }
          setSalaryPayingId(null);
        },
        modal: { ondismiss: () => setSalaryPayingId(null) },
        theme: { color: '#00C896' },
        prefill: { name: salarySlip.guard.name },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert(err.message || 'Payment failed');
      setSalaryPayingId(null);
    }
  };

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const headers = { 
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      };

      const [dirRes, activeRes, salaryRes, epRes] = await Promise.allSettled([
        fetch(`${API_BASE}/guards/directory?date=${selectedDate}`, { headers }),
        fetch(`${API_BASE}/guards/active`, { headers }),
        fetch(`${API_BASE}/guards/salaries${salaryMonthFilter ? `?month=${salaryMonthFilter}` : ''}`, { headers }),
        fetch(`${API_BASE}/entries/entry-points`, { headers })
      ]);

      if (dirRes.status === 'fulfilled' && dirRes.value.ok) {
        const data = await dirRes.value.json();
        setGuards(data.data || []);
      }
      if (activeRes.status === 'fulfilled' && activeRes.value.ok) {
        const data = await activeRes.value.json();
        setActiveGuards(data.data || []);
      }
      if (salaryRes.status === 'fulfilled' && salaryRes.value.ok) {
        const data = await salaryRes.value.json();
        setSalaryHistory(data.data || []);
      }
      if (epRes.status === 'fulfilled' && epRes.value.ok) {
        const data = await epRes.value.json();
        setEntryPoints(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch guard data', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [selectedDate, salaryMonthFilter]);

  const handleGuardDeleted = (id: string) => {
    setGuards(prev => prev.filter(x => x.id !== id));
    setActiveGuards(prev => prev.filter(x => x.id !== id));
    setSelectedGuard(null);
  };

  const filteredGuards = guards.filter(g => {
    const q = guardSearch.trim().toLowerCase();
    const matchesSearch = !q || g.name?.toLowerCase().includes(q) || g.badgeNumber?.toLowerCase().includes(q) || g.phone?.toLowerCase().includes(q);
    const matchesStatus = guardStatusFilter === 'All Status' || (guardStatusFilter === 'On Post' ? g.isOnDuty : !g.isOnDuty);
    return matchesSearch && matchesStatus;
  });

  if (selectedGuard) {
    return <GuardProfile guard={selectedGuard} onBack={() => setSelectedGuard(null)} onDeleted={() => handleGuardDeleted(selectedGuard.id)} />;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Guard Management</h1>
          <p className="page-subtitle">Roster management, real-time monitoring, incident review, and manual override tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={fetchData} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={isRefreshing}>
            <span style={{ display: 'flex', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }}><Icon name="refresh" size={14} /></span>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { setGuardFormError(''); setIsAddGuardOpen(true); }}><Icon name="plus" size={16} /> Add Guard</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: '4px', borderRadius: '8px', marginBottom: 24, gap: '4px' }}>
        <button 
          onClick={() => setActiveTab('roster')}
          className={`tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
        >
          <Icon name="list" size={16} /> Guard Roster
        </button>
        <button 
          onClick={() => setActiveTab('live')}
          className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
        >
          <Icon name="activity" size={16} /> Live Monitoring
        </button>
        <button
          onClick={() => setActiveTab('salary')}
          className={`tab-btn ${activeTab === 'salary' ? 'active' : ''}`}
        >
          <Icon name="currency-rupee" size={16} /> Salary Management
        </button>
      </div>

      {/* Tab Content */}
      <div className="card" style={{ padding: 0 }}>
        
        {/* ROSTER TAB */}
        {activeTab === 'roster' && (
          <div style={{ padding: '0 0 24px 0' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '0 24px', alignItems: 'center' }}>
              <div className="search-container" style={{ width: 320 }}>
                <Icon name="search" size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search guards..."
                  className="form-input search-input"
                  value={guardSearch}
                  onChange={(e) => setGuardSearch(e.target.value)}
                />
              </div>
              <select className="form-input" style={{ width: 140, cursor: 'pointer' }} defaultValue="All Shifts">
                <option value="All Shifts">All Shifts</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Night">Night</option>
              </select>
              <select
                className="form-input"
                style={{ width: 140, cursor: 'pointer' }}
                value={guardStatusFilter}
                onChange={(e) => setGuardStatusFilter(e.target.value)}
              >
                <option value="All Status">All Status</option>
                <option value="On Post">On Post</option>
                <option value="Offline">Offline</option>
              </select>
              <input 
                type="date" 
                className="form-input" 
                style={{ width: 140, cursor: 'pointer' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 8 }}>{filteredGuards.length} guards</span>
            </div>
            
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="table-header-row">
                  <th style={{ padding: '12px 24px' }}>Guard</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Post</th>
                  <th style={{ padding: '12px 16px' }}>Shift</th>
                  <th style={{ padding: '12px 16px' }}>Entries ({selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : selectedDate})</th>
                  <th style={{ padding: '12px 16px' }}>Rating</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuards.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon="shield-check" message={guards.length === 0 ? 'No guards found in directory.' : 'No guards match your search/filter.'} compact /></td></tr>
                ) : (
                  filteredGuards.map((g, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row">
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ position: 'relative' }}>
                            {g.photoUrl ? (
                              <img src={g.photoUrl} alt={g.name} className="table-avatar" style={{ width: 40, height: 40 }} />
                            ) : (
                              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(g.name)}&background=0D2B24&color=00C896`} alt={g.name} className="table-avatar" style={{ width: 40, height: 40 }} />
                            )}
                            {/* Status Dot */}
                            <span style={{
                              position: 'absolute', bottom: 0, right: 0,
                              width: 10, height: 10, borderRadius: '50%',
                              backgroundColor: g.onLeave ? '#F59E0B' : g.isOnDuty ? '#00C896' : '#94A3B8',
                              border: '2px solid white'
                            }}></span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-main)', marginBottom: 2 }}>{g.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{g.badgeNumber || 'PG-SEC-001'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {g.onLeave ? (
                          <span className="status-badge-modern" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>On Leave</span>
                        ) : (
                          <span className={`status-badge-modern ${g.isOnDuty ? 'status-on-post-modern' : 'status-offline-modern'}`}>{g.isOnDuty ? 'On Post' : 'Offline'}</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>{g.lastPost?.entryPoint?.name || 'Not assigned'}</td>
                      <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {g.lastShift?.startedAt
                          ? `${new Date(g.lastShift.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${g.lastShift.endedAt ? new Date(g.lastShift.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}`
                          : '—'}
                      </td>
                      <td style={{ padding: '16px', fontWeight: 600, fontSize: 14 }}>
                        {g.entriesCount !== undefined ? g.entriesCount : (g.lastShift?.totalEntries || 0)}
                      </td>
                      <td style={{ padding: '16px', fontSize: 13, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          4.5 <Icon name="star-filled" size={14} color="var(--warning)" />
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="action-btn" title="View Profile" onClick={() => setSelectedGuard(g)}>
                            <Icon name="eye" size={16} />
                          </button>
                          <button className="action-btn" title="Pay Salary" onClick={() => openSalaryModal(g)} style={{ color: '#16a34a' }}>
                            <Icon name="currency-rupee" size={16} />
                          </button>
                          <button className="action-btn" title="Remove Guard" onClick={() => setSelectedGuard(g)} style={{ color: 'var(--danger)' }}>
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* LIVE MONITORING TAB */}
        {activeTab === 'live' && (
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {activeGuards.length === 0 ? (
              <div style={{ gridColumn: '1 / -1' }}><EmptyState icon="user-check" message="No guards are currently active on duty." /></div>
            ) : (
              activeGuards.map((g, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.entryPoint?.name || 'Unassigned'}</div>
                    </div>
                    <span className="status-badge status-on-post">On Post</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                    <div>Morning Shift</div>
                    <div>Last: {g.checkedInAt ? new Date(g.checkedInAt).toLocaleTimeString() : 'N/A'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SALARY TAB */}
        {activeTab === 'salary' && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <input
                type="month"
                className="form-input"
                style={{ width: 180, cursor: 'pointer' }}
                value={salaryMonthFilter}
                onChange={(e) => setSalaryMonthFilter(e.target.value)}
              />
              {salaryMonthFilter && (
                <button className="btn btn-outline" onClick={() => setSalaryMonthFilter('')}>Clear filter</button>
              )}
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{salaryHistory.length} record{salaryHistory.length === 1 ? '' : 's'}</span>
            </div>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 12, borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px' }}>Guard</th>
                  <th style={{ padding: '12px 16px' }}>Month</th>
                  <th style={{ padding: '12px 16px' }}>Base Salary</th>
                  <th style={{ padding: '12px 16px' }}>Deductions</th>
                  <th style={{ padding: '12px 16px' }}>Net Amount</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Paid On</th>
                </tr>
              </thead>
              <tbody>
                {salaryHistory.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon="currency-rupee" message={salaryMonthFilter ? 'No salary records for this month.' : 'No salary records found.'} compact /></td></tr>
                ) : (
                  salaryHistory.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} className="table-row" onClick={() => openSalaryModal(s.guard)}>
                      <td style={{ padding: '16px', fontSize: 13 }}>
                        <div style={{ fontWeight: 600 }}>{s.guard?.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>{s.guard?.badgeNumber}</div>
                      </td>
                      <td style={{ padding: '16px', fontSize: 13 }}>{new Date(s.monthYear + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</td>
                      <td style={{ padding: '16px', fontSize: 13 }}>₹{Number(s.baseSalary).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '16px', fontSize: 13, color: s.deductions > 0 ? '#DC2626' : 'inherit' }}>₹{Number(s.deductions).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '16px', fontSize: 13, fontWeight: 600 }}>₹{Number(s.netAmount).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '16px' }}>
                        <span className="status-badge-modern" style={{ backgroundColor: s.status === 'PAID' ? '#E6FBF5' : '#FEF3C7', color: s.status === 'PAID' ? '#00A676' : '#D97706' }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>{s.paidAt ? new Date(s.paidAt).toLocaleDateString('en-IN') : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Add Guard Modal */}
      {isAddGuardOpen && (
        <div className="modal-overlay" onClick={() => setIsAddGuardOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add New Guard</h3>
                <p className="modal-subtitle">Create a new guard account and assign post/shift</p>
              </div>
              <button className="modal-close" onClick={() => setIsAddGuardOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              {guardFormError && (
                <div style={{ padding: '10px 14px', marginBottom: 20, background: '#ffebee', color: '#c62828', borderRadius: 8, fontSize: 13, whiteSpace: 'pre-line' }}>
                  {guardFormError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                {/* Photo Upload Area */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div 
                    style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#F1F5F9', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {newGuardForm.photoUrl ? (
                      <img src={newGuardForm.photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Icon name="upload" size={24} color="var(--text-muted)" />
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }} onClick={() => fileInputRef.current?.click()}>
                    Upload Photo
                  </span>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handlePhotoUpload} />
                </div>
                
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Rajesh Kumar" 
                    value={newGuardForm.name}
                    onChange={e => setNewGuardForm({...newGuardForm, name: e.target.value.toUpperCase()})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Badge ID</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. SEC-1150" 
                    value={newGuardForm.badgeId}
                    onChange={e => setNewGuardForm({...newGuardForm, badgeId: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="+91 98xxx xxxxx" 
                    value={newGuardForm.phone}
                    onChange={e => setNewGuardForm({...newGuardForm, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="guard@example.com"
                    value={newGuardForm.email}
                    onChange={e => setNewGuardForm({...newGuardForm, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <PasswordInput
                    autoComplete="new-password"
                    className="form-input"
                    placeholder="Login password (min 6 chars)"
                    value={newGuardForm.password}
                    onChange={e => setNewGuardForm({...newGuardForm, password: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Post Assignment</label>
                  <select 
                    className="form-input" 
                    value={newGuardForm.post}
                    onChange={e => setNewGuardForm({...newGuardForm, post: e.target.value})}
                  >
                    <option value="">Select a post...</option>
                    {entryPoints.map(ep => (
                      <option key={ep.id} value={ep.name}>{ep.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Joining</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={newGuardForm.dateOfJoining}
                    onChange={e => setNewGuardForm({...newGuardForm, dateOfJoining: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Shift</label>
                  <select 
                    className="form-input" 
                    value={newGuardForm.shift}
                    onChange={e => setNewGuardForm({...newGuardForm, shift: e.target.value})}
                  >
                    <option value="morning">Morning (06:00-14:00)</option>
                    <option value="afternoon">Afternoon (14:00-22:00)</option>
                    <option value="night">Night (22:00-06:00)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Status</label>
                  <select 
                    className="form-input" 
                    value={newGuardForm.status}
                    onChange={e => setNewGuardForm({...newGuardForm, status: e.target.value})}
                  >
                    <option value="On Post">On Post</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setIsAddGuardOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateGuard}>Create Guard</button>
            </div>
          </div>
        </div>
      )}

      {/* Salary Slip Modal */}
      {(salaryLoading || salarySlip || salaryError) && (
        <div className="modal-overlay" onClick={() => { if (!salaryPayingId) { setSalarySlip(null); setSalaryError(''); } }}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Salary Slip</h3>
                <p className="modal-subtitle">{salarySlip ? `${salarySlip.guard?.name} — ${new Date(salarySlip.monthYear + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}` : 'Loading...'}</p>
              </div>
              <button className="modal-close" onClick={() => { setSalarySlip(null); setSalaryError(''); }}>×</button>
            </div>
            <div className="modal-body">
              {salaryLoading && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Generating salary slip...</div>}
              {salaryError && <div style={{ padding: 16, background: '#ffebee', color: '#c62828', borderRadius: 6 }}>{salaryError}</div>}
              {salarySlip && (
                <div>
                  {/* Status Banner */}
                  {salarySlip.status === 'PAID' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#dcfce7', color: '#166534', borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>
                      <Icon name="circle-check" size={18} /> Salary Paid — {salarySlip.paidAt ? new Date(salarySlip.paidAt).toLocaleDateString('en-IN') : ''}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fefce8', color: '#854d0e', borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>
                      <Icon name="clock" size={18} /> Payment Pending
                    </div>
                  )}

                  {/* Breakdown Table */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Guard</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{salarySlip.guard?.name} ({salarySlip.guard?.badgeNumber})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Month</span>
                      <span style={{ fontSize: 13 }}>{new Date(salarySlip.monthYear + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Base Salary</span>
                      {salarySlip.status === 'PAID' ? (
                        <span style={{ fontSize: 13 }}>₹{Number(editBase).toLocaleString('en-IN')}</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13 }}>₹</span>
                          <input
                            type="number" min={0}
                            value={editBase}
                            onChange={e => setEditBase(e.target.value === '' ? '' : Number(e.target.value))}
                            style={{ width: 100, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-color)', background: Number(editDed) > 0 ? '#fff7ed' : undefined }}>
                      <span style={{ color: Number(editDed) > 0 ? '#c2410c' : 'var(--text-muted)', fontSize: 13 }}>Leave Deductions</span>
                      {salarySlip.status === 'PAID' ? (
                        <span style={{ fontSize: 13, color: Number(editDed) > 0 ? '#c2410c' : undefined }}>− ₹{Number(editDed).toLocaleString('en-IN')}</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13, color: '#c2410c' }}>− ₹</span>
                          <input
                            type="number" min={0}
                            value={editDed}
                            onChange={e => setEditDed(e.target.value === '' ? '' : Number(e.target.value))}
                            style={{ width: 100, padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-color)' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>Net Payable</span>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#16a34a' }}>₹{(Number(editBase || 0) - Number(editDed || 0)).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {salarySlip.transactionId && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Transaction ID: {salarySlip.transactionId}</div>
                  )}
                </div>
              )}
            </div>
            {salarySlip && salarySlip.status !== 'PAID' && (
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                {/* 👱‍♀️ ponytail: minimalist HTML blob download, zero dependencies */}
                <button className="btn btn-outline" onClick={() => {
                  const net = Number(editBase||0) - Number(editDed||0);
                  const content = `<html><body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;"><h2>SALARY SLIP / INVOICE</h2><p><strong>Guard:</strong> ${salarySlip.guard?.name} (${salarySlip.guard?.badgeNumber})</p><p><strong>Month:</strong> ${new Date(salarySlip.monthYear + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</p><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/><p>Base Salary: &#8377;${Number(editBase||0).toLocaleString('en-IN')}</p><p>Leave Deductions: -&#8377;${Number(editDed||0).toLocaleString('en-IN')}</p><h3>Net Payable: &#8377;${net.toLocaleString('en-IN')}</h3><p><strong>Status:</strong> ${salarySlip.status}</p>${salarySlip.transactionId ? `<p>Transaction ID: ${salarySlip.transactionId}</p>` : ''}<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/><p style="font-size: 12px; color: gray;">Generated by SecureGate</p></body></html>`;
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([content], { type: 'text/html' }));
                  a.download = `Invoice_${salarySlip.guard?.badgeNumber}_${salarySlip.monthYear}.html`;
                  a.click();
                }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="download" size={16} /> Download
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline" onClick={() => { setSalarySlip(null); setSalaryError(''); }}>Close</button>
                <button
                  className="btn btn-primary"
                  onClick={handlePaySalary}
                  disabled={!!salaryPayingId}
                  style={{ background: '#16a34a', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Icon name="currency-rupee" size={16} />
                  {salaryPayingId ? 'Processing...' : `Pay ₹${(Number(editBase||0) - Number(editDed||0)).toLocaleString('en-IN')} via Razorpay`}
                </button>
                </div>
              </div>
            )}
            {salarySlip && salarySlip.status === 'PAID' && (
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <button className="btn btn-outline" onClick={() => {
                  const content = `<html><body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;"><h2>SALARY SLIP / INVOICE</h2><p><strong>Guard:</strong> ${salarySlip.guard?.name} (${salarySlip.guard?.badgeNumber})</p><p><strong>Month:</strong> ${new Date(salarySlip.monthYear + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</p><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/><p>Base Salary: &#8377;${salarySlip.baseSalary?.toLocaleString('en-IN')}</p><p>Leave Deductions: -&#8377;${salarySlip.deductions?.toLocaleString('en-IN')}</p><h3>Net Payable: &#8377;${salarySlip.netAmount?.toLocaleString('en-IN')}</h3><p><strong>Status:</strong> ${salarySlip.status}</p>${salarySlip.transactionId ? `<p>Transaction ID: ${salarySlip.transactionId}</p>` : ''}<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/><p style="font-size: 12px; color: gray;">Generated by SecureGate</p></body></html>`;
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([content], { type: 'text/html' }));
                  a.download = `Invoice_${salarySlip.guard?.badgeNumber}_${salarySlip.monthYear}.html`;
                  a.click();
                }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="download" size={16} /> Download
                </button>
                <button className="btn btn-outline" onClick={() => { setSalarySlip(null); setSalaryError(''); }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardManagement;
