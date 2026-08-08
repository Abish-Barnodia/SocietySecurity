import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Ban, Upload, List, Activity, AlertCircle, UserCog, Search, ChevronDown, Eye, Star } from 'lucide-react';
import GuardProfile from './GuardProfile';

const API_BASE = 'http://localhost:5000/api/v1';

const GuardManagement: React.FC = () => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';
  
  const [activeTab, setActiveTab] = useState<'roster' | 'live' | 'incidents' | 'overrides'>('roster');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [guards, setGuards] = useState<any[]>([]);
  const [activeGuards, setActiveGuards] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [selectedGuard, setSelectedGuard] = useState<any>(null);

  const [isAddGuardOpen, setIsAddGuardOpen] = useState(false);
  const [newGuardForm, setNewGuardForm] = useState({
    name: '', badgeId: '', phone: '', email: '', password: '', post: '', shift: 'morning', status: 'On Post', dateOfJoining: '', photoUrl: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setNewGuardForm({ ...newGuardForm, photoUrl: url });
    }
  };

  const handleCreateGuard = async () => {
    if (!newGuardForm.email.trim()) { alert('Email is required so the guard can log in to the guard app'); return; }
    if (newGuardForm.password.length < 6) { alert('Password must be at least 6 characters'); return; }
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
        setNewGuardForm({ name: '', badgeId: '', phone: '', email: '', password: '', post: '', shift: 'morning', status: 'On Post', dateOfJoining: '', photoUrl: '' });
        fetchData(); // refresh the directory
      } else {
        const errorData = await response.json();
        alert(`Failed to create guard: ${errorData.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error creating guard');
    }
  };

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const headers = { 
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      };

      const [dirRes, activeRes, incRes, auditRes] = await Promise.allSettled([
        fetch(`${API_BASE}/guards/directory`, { headers }),
        fetch(`${API_BASE}/guards/active`, { headers }),
        fetch(`${API_BASE}/incidents`, { headers }),
        fetch(`${API_BASE}/reports/audit`, { headers })
      ]);

      if (dirRes.status === 'fulfilled' && dirRes.value.ok) {
        const data = await dirRes.value.json();
        setGuards(data.data || []);
      }
      if (activeRes.status === 'fulfilled' && activeRes.value.ok) {
        const data = await activeRes.value.json();
        setActiveGuards(data.data || []);
      }
      if (incRes.status === 'fulfilled' && incRes.value.ok) {
        const data = await incRes.value.json();
        setIncidents(data.data || []);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const data = await auditRes.value.json();
        setAuditLogs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch guard data', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (selectedGuard) {
    return <GuardProfile guard={selectedGuard} onBack={() => setSelectedGuard(null)} />;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Guard Management</h1>
          <p className="page-subtitle">Roster management, real-time monitoring, incident review, and manual override tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={fetchData} className="btn btn-outline" disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
          <button className="btn btn-primary" onClick={() => setIsAddGuardOpen(true)}>+ Add Guard</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: '4px', borderRadius: '8px', marginBottom: 24, gap: '4px' }}>
        <button 
          onClick={() => setActiveTab('roster')}
          className={`tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
        >
          <List size={16} /> Guard Roster
        </button>
        <button 
          onClick={() => setActiveTab('live')}
          className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
        >
          <Activity size={16} /> Live Monitoring
        </button>
        <button 
          onClick={() => setActiveTab('incidents')}
          className={`tab-btn ${activeTab === 'incidents' ? 'active' : ''}`}
        >
          <AlertCircle size={16} /> Incidents
        </button>
        <button 
          onClick={() => setActiveTab('overrides')}
          className={`tab-btn ${activeTab === 'overrides' ? 'active' : ''}`}
        >
          <UserCog size={16} /> Override Log
        </button>
      </div>

      {/* Tab Content */}
      <div className="card" style={{ padding: 0 }}>
        
        {/* ROSTER TAB */}
        {activeTab === 'roster' && (
          <div style={{ padding: '0 0 24px 0' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '0 24px', alignItems: 'center' }}>
              <div className="search-container" style={{ width: 320 }}>
                <Search size={16} className="search-icon" />
                <input type="text" placeholder="Search guards..." className="form-input search-input" />
              </div>
              <select className="form-input" style={{ width: 140, cursor: 'pointer' }} defaultValue="All Shifts">
                <option value="All Shifts">All Shifts</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Night">Night</option>
              </select>
              <select className="form-input" style={{ width: 140, cursor: 'pointer' }} defaultValue="All Status">
                <option value="All Status">All Status</option>
                <option value="On Post">On Post</option>
                <option value="Offline">Offline</option>
              </select>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 8 }}>{guards.length} guards</span>
            </div>
            
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="table-header-row">
                  <th style={{ padding: '12px 24px' }}>Guard</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Post</th>
                  <th style={{ padding: '12px 16px' }}>Shift</th>
                  <th style={{ padding: '12px 16px' }}>Entries Today</th>
                  <th style={{ padding: '12px 16px' }}>Rating</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {guards.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No guards found in directory.</td></tr>
                ) : (
                  guards.map((g, idx) => (
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
                              backgroundColor: g.isOnDuty ? '#00C896' : '#94A3B8',
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
                        <span className={`status-badge-modern ${g.isOnDuty ? 'status-on-post-modern' : 'status-offline-modern'}`}>{g.isOnDuty ? 'On Post' : 'Offline'}</span>
                      </td>
                      <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>{g.lastPost?.entryPoint?.name || 'Main Gate — Entry'}</td>
                      <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        06:00 - 14:00
                      </td>
                      <td style={{ padding: '16px', fontWeight: 600, fontSize: 14 }}>
                        {g.lastShift?.totalEntries || Math.floor(Math.random() * 50 + 20)}
                      </td>
                      <td style={{ padding: '16px', fontSize: 13, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          4.5 <Star size={14} fill="#F59E0B" color="#F59E0B" />
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="action-btn" title="View Profile" onClick={() => setSelectedGuard(g)}>
                            <Eye size={16} />
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
              <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No guards are currently active on duty.</div>
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

        {/* INCIDENTS TAB */}
        {activeTab === 'incidents' && (
          <div style={{ padding: 24 }}>
             <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 12, borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px' }}>Time</th>
                  <th style={{ padding: '12px 16px' }}>Guard / Post</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No incidents logged.</td></tr>
                ) : (
                  incidents.map((inc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>{new Date(inc.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '16px', fontSize: 13 }}>
                        <div style={{ fontWeight: 600 }}>{inc.guard?.user?.name || 'Unknown Guard'}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{inc.location}</div>
                      </td>
                      <td style={{ padding: '16px', fontSize: 13 }}>{inc.type}</td>
                      <td style={{ padding: '16px' }}>
                        <span className="status-badge" style={{ backgroundColor: inc.status === 'CLOSED' ? '#F1F5F9' : '#FEF3C7', color: inc.status === 'CLOSED' ? '#64748B' : '#D97706' }}>
                          {inc.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: 13, maxWidth: 300 }}>{inc.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* OVERRIDES TAB */}
        {activeTab === 'overrides' && (
          <div style={{ padding: 24 }}>
             <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 12, borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Actor</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                  <th style={{ padding: '12px 16px' }}>Entity</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found.</td></tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>{new Date(log.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '16px', fontSize: 13, fontWeight: 600 }}>{log.user?.name || 'Unknown'} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({log.user?.role})</span></td>
                      <td style={{ padding: '16px' }}>
                        <span className="severity-badge" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>{log.action}</span>
                      </td>
                      <td style={{ padding: '16px', fontSize: 13 }}>{log.entity} #{log.entityId}</td>
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
                      <Upload size={24} color="var(--text-muted)" />
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
                    onChange={e => setNewGuardForm({...newGuardForm, name: e.target.value})}
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
                    onChange={e => setNewGuardForm({...newGuardForm, badgeId: e.target.value})}
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
                  <input
                    type="password"
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
                    <option value="main-gate">Main Gate - Tower A</option>
                    <option value="service">Service Gate</option>
                    <option value="parking">Parking Entry</option>
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
    </div>
  );
};

export default GuardManagement;
