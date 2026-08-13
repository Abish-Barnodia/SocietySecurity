import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const GuardLeaveManagement: React.FC = () => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';

  const [leaves, setLeaves] = useState<any[]>([]);
  const [guards, setGuards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);
  const [newLeaveForm, setNewLeaveForm] = useState({
    guardId: '', startDate: '', endDate: '', reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [leavesRes, guardsRes] = await Promise.all([
        fetch(`${API_BASE}/guards/leaves`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } }),
        fetch(`${API_BASE}/guards/directory`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } })
      ]);
      
      const leavesData = await leavesRes.json();
      const guardsData = await guardsRes.json();

      if (leavesData.status === 'success') {
        setLeaves(leavesData.data);
      }
      
      if (guardsData.status === 'success') {
        setGuards(guardsData.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLeave = async () => {
    if (!newLeaveForm.guardId || !newLeaveForm.startDate || !newLeaveForm.endDate || !newLeaveForm.reason) {
      alert('Please fill all fields');
      return;
    }
    
    if (new Date(newLeaveForm.startDate) > new Date(newLeaveForm.endDate)) {
      alert('Start date cannot be after end date');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/guards/leaves`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newLeaveForm)
      });
      
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setIsAddLeaveOpen(false);
        setNewLeaveForm({ guardId: '', startDate: '', endDate: '', reason: '' });
        fetchData();
      } else {
        alert(data.message || 'Failed to assign leave');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    }
  };

  const handleCancelLeave = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this leave?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/guards/leaves/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to cancel leave');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    }
  };

  const getStatusBadge = (leave: any) => {
    if (leave.status === 'CANCELLED') {
      return <span style={{ padding: '4px 8px', background: '#ffebee', color: '#c62828', borderRadius: '4px', fontSize: 12, fontWeight: 500 }}>Cancelled</span>;
    }
    
    const now = new Date();
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    
    if (now >= start && now <= end) {
      return <span style={{ padding: '4px 8px', background: '#fff3e0', color: '#e65100', borderRadius: '4px', fontSize: 12, fontWeight: 500 }}>On Leave</span>;
    } else if (now < start) {
      return <span style={{ padding: '4px 8px', background: '#e3f2fd', color: '#1565c0', borderRadius: '4px', fontSize: 12, fontWeight: 500 }}>Upcoming</span>;
    } else {
      return <span style={{ padding: '4px 8px', background: '#e0e0e0', color: '#424242', borderRadius: '4px', fontSize: 12, fontWeight: 500 }}>Completed</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const calculateDays = (start: string, end: string) => {
    const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
    return diffDays;
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2>Guard Leave Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage leaves for security guards. Approved leaves will restrict guard app access.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsAddLeaveOpen(true)}>
          <Icon name="calendar-plus" size={18} /> Give Leave
        </button>
      </div>

      {error && <div style={{ padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 4, marginBottom: 16 }}>{error}</div>}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: 12 }}>GUARD</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: 12 }}>FROM</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: 12 }}>TO</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: 12 }}>DAYS</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: 12 }}>REASON</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: 12 }}>STATUS</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: 12, textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : leaves.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No leave records found</td></tr>
            ) : (
              leaves.map(leave => (
                <tr key={leave.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500 }}>{leave.guard.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{leave.guard.badgeNumber}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>{formatDate(leave.startDate)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>{formatDate(leave.endDate)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>{calculateDays(leave.startDate, leave.endDate)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={leave.reason}>{leave.reason}</td>
                  <td style={{ padding: '12px 16px' }}>{getStatusBadge(leave)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {leave.status === 'APPROVED' && new Date(leave.endDate) >= new Date() && (
                      <button 
                        onClick={() => handleCancelLeave(leave.id)}
                        style={{ background: 'transparent', border: '1px solid #c62828', color: '#c62828', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAddLeaveOpen && (
        <div className="modal-overlay" onClick={() => setIsAddLeaveOpen(false)}>
          <div className="modal-content" style={{ width: 400, maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Assign Leave</h3>
              <button className="modal-close" onClick={() => setIsAddLeaveOpen(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Select Guard</label>
                <select 
                  className="form-input"
                  value={newLeaveForm.guardId}
                  onChange={e => setNewLeaveForm({...newLeaveForm, guardId: e.target.value})}
                >
                  <option value="">-- Select Guard --</option>
                  {guards.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.badgeNumber})</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }} className="form-group">
                  <label className="form-label">From Date</label>
                  <input 
                    type="date"
                    className="form-input"
                    value={newLeaveForm.startDate}
                    onChange={e => setNewLeaveForm({...newLeaveForm, startDate: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div style={{ flex: 1 }} className="form-group">
                  <label className="form-label">To Date</label>
                  <input 
                    type="date"
                    className="form-input"
                    value={newLeaveForm.endDate}
                    onChange={e => setNewLeaveForm({...newLeaveForm, endDate: e.target.value})}
                    min={newLeaveForm.startDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea 
                  className="form-input"
                  style={{ minHeight: 80, resize: 'vertical' }}
                  placeholder="e.g. Medical, Vacation, Family Emergency"
                  value={newLeaveForm.reason}
                  onChange={e => setNewLeaveForm({...newLeaveForm, reason: e.target.value})}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setIsAddLeaveOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateLeave}>
                Save Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardLeaveManagement;
