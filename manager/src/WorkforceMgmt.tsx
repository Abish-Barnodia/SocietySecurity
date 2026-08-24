import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import EmptyState from './EmptyState';
import GuardLeaveManagement from './GuardLeaveManagement';
import { API_BASE } from './config';

const WorkforceMgmt = () => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';
  
  const [activeTab, setActiveTab] = useState('workerPool');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [workers, setWorkers] = useState<any[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<any[]>([]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', badgeNumber: '', status: 'Off Duty' });
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignGuardId, setAssignGuardId] = useState<string | null>(null);
  const [entryPoints, setEntryPoints] = useState<any[]>([]);
  const [selectedEntryPoint, setSelectedEntryPoint] = useState('');

  const fetchWorkforceData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${getAuthToken()}` };

      // Worker Pool (using Guard directory as proxy for all property workers as per schema)
      const resDirectory = await fetch(`${API_BASE}/guards/directory`, { headers });
      if (resDirectory.ok) {
        const data = await resDirectory.json();
        setWorkers(data.data || []);
      }

      // Active Assignments (Guards on Duty)
      const resActive = await fetch(`${API_BASE}/guards/active`, { headers });
      if (resActive.ok) {
        const data = await resActive.json();
        setActiveAssignments(data.data || []);
      }

      // Fetch Entry Points for Assignment Modal
      const resEntryPoints = await fetch(`${API_BASE}/entries/entry-points`, { headers });
      if (resEntryPoints.ok) {
        const data = await resEntryPoints.json();
        setEntryPoints(data.data || []);
      }

    } catch (error) {
      console.error('Failed to fetch workforce data', error);
      showToast('Error loading workforce data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkforceData();
  }, []);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAssignPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignGuardId || !selectedEntryPoint) return;
    try {
      const res = await fetch(`${API_BASE}/guards/${assignGuardId}/assign`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryPointId: selectedEntryPoint })
      });
      if (res.ok) {
        setIsAssignModalOpen(false);
        setAssignGuardId(null);
        setSelectedEntryPoint('');
        showToast('Worker assigned successfully');
        fetchWorkforceData();
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to assign worker', 'error');
      }
    } catch (err) {
      showToast('Unexpected error occurred', 'error');
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/guards`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setAddForm({ name: '', phone: '', badgeNumber: '', status: 'Off Duty' });
        showToast('Worker added successfully');
        fetchWorkforceData();
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to add worker', 'error');
      }
    } catch (err) {
      showToast('Unexpected error occurred', 'error');
    }
  };

  const tabs = [
    { id: 'workerPool', label: 'Worker Pool', icon: <Icon name="users" size={16} /> },
    { id: 'activeAssignments', label: 'Active Assignments', icon: <Icon name="briefcase" size={16} /> },
    { id: 'leaves', label: 'Leaves & Time Off', icon: <Icon name="calendar-off" size={16} /> },
  ];

  return (
    <div style={{ padding: 24, flex: 1, backgroundColor: 'var(--bg-secondary)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Workforce Management</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Leave tracking, relief guard assignment, shift swaps, and multi-type worker pool management</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6, backgroundColor: 'var(--primary)', color: 'white', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          + Add Worker
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
              borderRadius: 8,
              fontWeight: activeTab === tab.id ? 600 : 500,
              color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Icon name="loader-2" className="spin" size={32} color="var(--primary)" />
        </div>
      ) : (
        <>
          {/* WORKER POOL */}
          {activeTab === 'workerPool' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {workers.length === 0 ? (
                <div style={{ gridColumn: '1 / -1' }}><EmptyState icon="users" message="No workers found in directory." /></div>
              ) : (
                workers.map(w => (
                  <div key={w.id} style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontWeight: 600, fontSize: 16 }}>
                          {w.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{w.name}</h3>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Security Guard • {w.badgeNumber}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>4.5 <Icon name="star-filled" size={13} color="var(--warning)" /></span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 20 }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Status</div>
                        <div style={{ fontWeight: 500, color: w.isOnDuty ? '#059669' : '#4B5563' }}>{w.isOnDuty ? 'On Duty' : 'Available'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Phone</div>
                        <div style={{ fontWeight: 500 }}>{w.phone || 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Last Shift</div>
                        <div style={{ fontWeight: 500 }}>{w.lastShift ? new Date(w.lastShift.startedAt).toLocaleDateString() : 'None'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Check-ins</div>
                        <div style={{ fontWeight: 500 }}>{w.lastPost ? '1' : '0'}</div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setAssignGuardId(w.id);
                        setIsAssignModalOpen(true);
                      }}
                      style={{ width: '100%', padding: '10px 0', borderRadius: 6, backgroundColor: 'var(--primary)', color: 'white', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                    >
                      Assign to Post
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ACTIVE ASSIGNMENTS */}
          {activeTab === 'activeAssignments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeAssignments.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No active assignments currently.</div>
              ) : (
                activeAssignments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, backgroundColor: 'white', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 20px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                      <Icon name="shield-check" size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{a.name}</h3>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: '#D1FAE5', color: '#059669' }}>
                          active
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                        <span>{a.badgeNumber}</span>
                        <span>•</span>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{a.entryPoint?.name || 'Unknown Post'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Checked in at: {a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* LEAVES */}
          {activeTab === 'leaves' && (
            <GuardLeaveManagement />
          )}
        </>
      )}

      {/* Add Worker Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 32, width: 450, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Add Worker</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="modal-close"><Icon name="x" size={18}/></button>
            </div>
            
            <form onSubmit={handleAddWorker} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Name</label>
                <input 
                  type="text" required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                  value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Phone (User Account Login)</label>
                <input 
                  type="text" required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                  value={addForm.phone} onChange={e => setAddForm({...addForm, phone: e.target.value})}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Badge / ID Number</label>
                <input 
                  type="text" required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box' }}
                  value={addForm.badgeNumber} onChange={e => setAddForm({...addForm, badgeNumber: e.target.value})}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Initial Status</label>
                <select 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box', backgroundColor: 'white' }}
                  value={addForm.status} onChange={e => setAddForm({...addForm, status: e.target.value})}
                >
                  <option value="Off Duty">Off Duty</option>
                  <option value="On Post">On Duty</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button 
                  type="button" onClick={() => setIsAddModalOpen(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 6, backgroundColor: 'white', border: '1px solid #E5E7EB', color: '#4B5563', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ flex: 1, padding: '12px', borderRadius: 6, backgroundColor: 'var(--primary)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 32, width: 400, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Assign to Post</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="modal-close"><Icon name="x" size={18}/></button>
            </div>
            
            <form onSubmit={handleAssignPost} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Select Post / Gate</label>
                <select 
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', boxSizing: 'border-box', backgroundColor: 'white' }}
                  value={selectedEntryPoint} onChange={e => setSelectedEntryPoint(e.target.value)}
                >
                  <option value="">Select a post...</option>
                  {entryPoints.map(ep => (
                    <option key={ep.id} value={ep.id}>{ep.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button 
                  type="button" onClick={() => setIsAssignModalOpen(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 6, backgroundColor: 'white', border: '1px solid #E5E7EB', color: '#4B5563', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ flex: 1, padding: '12px', borderRadius: 6, backgroundColor: 'var(--primary)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                >
                  Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, backgroundColor: toast.type === 'error' ? '#FEE2E2' : '#DCFCE7', color: toast.type === 'error' ? '#991B1B' : '#166534', padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999, border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#86EFAC'}`, fontWeight: 500, fontSize: 14 }}>
          {toast.message}
        </div>
      )}

    </div>
  );
};

export default WorkforceMgmt;
