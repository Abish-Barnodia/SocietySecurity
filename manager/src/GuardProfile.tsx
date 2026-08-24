import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

interface GuardProfileProps {
  guard: any; // Basic info passed from roster
  onBack: () => void;
  onDeleted?: () => void;
}


const GuardProfile: React.FC<GuardProfileProps> = ({ guard: initialGuard, onBack, onDeleted }) => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';
  const [guard, setGuard] = useState(initialGuard);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isEditModalOpen, setIsEditOpen] = useState(false);
  const [isFlagModalOpen, setIsFlagOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignOpen] = useState(false);
  const [isForceClearModalOpen, setIsForceClearOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Form states
  const [editForm, setEditForm] = useState({
    name: initialGuard.name,
    phone: initialGuard.phone || ''
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [flagForm, setFlagForm] = useState({ reason: 'Late Arrival', notes: '' });
  const [reassignPostName, setReassignPostName] = useState('Main Gate — Entry');

  const handleEditSubmit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`${API_BASE}/guards/${guard.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name, phone: editForm.phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.message || 'Failed to update guard');
        return;
      }
      setGuard({ ...guard, name: data.data.name, phone: editForm.phone });
      setIsEditOpen(false);
    } catch (err) {
      setEditError('Network error while updating guard');
    } finally {
      setEditSaving(false);
    }
  };

  const handleFlagSubmit = () => {
    const newTimelineItem = {
      type: 'incident',
      title: flagForm.reason,
      description: flagForm.notes,
      timestamp: new Date().toISOString()
    };
    setGuard({ ...guard, timeline: [newTimelineItem, ...(guard.timeline || [])], stats: { ...guard.stats, incidents: (guard.stats?.incidents || 0) + 1 } });
    setIsFlagOpen(false);
    setFlagForm({ reason: 'Late Arrival', notes: '' });
  };

  const handleReassignSubmit = () => {
    setGuard({ ...guard, lastPost: { ...guard.lastPost, entryPoint: { name: reassignPostName } }});
    setIsReassignOpen(false);
  };

  const handleForceClear = () => {
    setGuard({ ...guard, lastShift: { ...guard.lastShift, endedAt: new Date().toISOString() }});
    setIsForceClearOpen(false);
  };

  const handleDeleteGuard = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API_BASE}/guards/${guard.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.message || 'Failed to remove guard');
        return;
      }
      setIsDeleteOpen(false);
      onDeleted?.();
    } catch (err) {
      setDeleteError('Network error while removing guard');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE}/guards/${initialGuard.id}/profile`, {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (response.ok) {
          const data = await response.json();
          // Merge fetched detailed data with initial guard (photoUrl usually kept in frontend for mock)
          setGuard({ ...initialGuard, ...data.data });
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [initialGuard.id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Icon name="loader-2" className="spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* Back Button */}
      <button 
        onClick={onBack}
        style={{ 
          background: 'none', border: 'none', color: 'var(--text-muted)', 
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, 
          cursor: 'pointer', marginBottom: 20, padding: 0 
        }}
      >
        <Icon name="arrow-left" size={16} /> Back to Guards
      </button>

      {/* Main Profile Card */}
      <div className="card" style={{ padding: 32, marginBottom: 24, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              {guard.photoUrl ? (
                <img src={guard.photoUrl} alt={guard.name} style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover' }} />
              ) : (
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(guard.name)}&background=0D2B24&color=00C896&size=128`} alt={guard.name} style={{ width: 80, height: 80, borderRadius: 16 }} />
              )}
              <span style={{
                position: 'absolute', bottom: -4, right: -4,
                width: 18, height: 18, borderRadius: '50%',
                backgroundColor: guard.onLeave ? '#F59E0B' : guard.isOnDuty ? '#00C896' : '#94A3B8',
                border: '3px solid white'
              }}></span>
            </div>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{guard.name}</h2>
                {guard.onLeave ? (
                  <span className="status-badge-modern" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>On Leave</span>
                ) : (
                  <span className={`status-badge-modern ${guard.isOnDuty ? 'status-on-post-modern' : 'status-offline-modern'}`}>
                    {guard.isOnDuty ? 'On Post' : 'Offline'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 12 }}>
                {guard.badgeNumber || 'N/A'}
              </div>
              
              <div style={{ display: 'flex', gap: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="map-pin" size={14} /> {guard.lastPost?.entryPoint?.name || 'Unassigned'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="clock" size={14} /> {guard.lastShift ? `${new Date(guard.lastShift.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${guard.lastShift.endedAt ? new Date(guard.lastShift.endedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'}` : 'No active shift'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="phone" size={14} /> {guard.phone ? `+91 ${guard.phone.replace('+91', '')}` : 'No phone'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="calendar" size={14} /> Joined {guard.createdAt ? new Date(guard.createdAt).toLocaleDateString('en-US', {month:'short', year:'numeric'}) : 'Unknown'}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-outline" onClick={() => setIsEditOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px' }}>
              <Icon name="edit" size={14} /> Edit
            </button>
            <button className="btn btn-outline" onClick={() => setIsFlagOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px', color: '#D97706', borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
              <Icon name="flag" size={14} /> Flag
            </button>
            <button className="btn btn-outline" onClick={() => { setDeleteError(''); setIsDeleteOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px', color: '#DC2626', borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}>
              <Icon name="trash" size={14} /> Delete Guard
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 32, paddingTop: 32, borderTop: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Monthly Scans</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>{guard.stats?.monthlyScans || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Compliance</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#00C896' }}>{guard.stats?.compliance || 0}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Rating</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {guard.stats?.rating || 0} <Icon name="star-filled" size={20} color="var(--warning)" />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Incidents</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#D97706' }}>{guard.stats?.incidents || 0}</div>
          </div>
        </div>
      </div>

      {/* Certifications Card */}
      <div className="card" style={{ marginBottom: 24, padding: '20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontWeight: 600, color: 'var(--text-main)' }}>
          <Icon name="award" size={18} color="var(--text-muted)" /> Certifications & Training
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {guard.certifications?.length > 0 ? (
            guard.certifications.map((cert: string, idx: number) => (
              <span key={idx} style={{ padding: '6px 16px', backgroundColor: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: 20, fontSize: 13, color: 'var(--text-main)' }}>{cert}</span>
            ))
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No certifications recorded.</span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Activity Timeline */}
        <div className="card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontWeight: 600, color: 'var(--text-main)' }}>
            <Icon name="history" size={18} color="var(--text-muted)" /> Activity Timeline
          </div>
          
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20 }}>Today</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {guard.timeline?.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activity recorded today.</div>
            ) : (
              guard.timeline?.map((item: any, idx: number) => {
                const isCheckIn = item.type === 'check_in';
                const isIncident = item.type === 'incident';
                return (
                  <div key={idx} style={{ display: 'flex', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ 
                        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
                        backgroundColor: isCheckIn ? '#E6FBF5' : (isIncident ? '#FEE2E2' : '#FFFBEB'), 
                        color: isCheckIn ? '#00A676' : (isIncident ? '#EF4444' : '#D97706') 
                      }}>
                        {isCheckIn ? <Icon name="map-pin" size={16} /> : (isIncident ? <Icon name="alert-circle" size={16} /> : <Icon name="scan" size={16} />)}
                      </div>
                      {idx !== guard.timeline.length - 1 && (
                        <div style={{ width: 2, height: '100%', backgroundColor: '#F1F5F9', marginTop: -4, marginBottom: -24 }}></div>
                      )}
                    </div>
                    <div style={{ flex: 1, paddingBottom: idx !== guard.timeline.length - 1 ? 24 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-main)', marginBottom: 4 }}>{item.description}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isCheckIn ? 'Location verified' : ''}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Current Shift */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontWeight: 600, color: 'var(--text-main)' }}>
              <Icon name="clock" size={16} color="var(--text-muted)" /> Current Shift
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Post</span>
                <span style={{ fontWeight: 500 }}>{guard.lastPost?.entryPoint?.name || 'Unassigned'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timing</span>
                <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>
                  {guard.lastShift ? `${new Date(guard.lastShift.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${guard.lastShift.endedAt ? new Date(guard.lastShift.endedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'}` : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Last Check-in</span>
                <span style={{ fontWeight: 500 }}>
                  {guard.lastPost ? new Date(guard.lastPost.checkedInAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'Never'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Entries Today</span>
                <span style={{ fontWeight: 500 }}>{guard.lastShift?.totalEntries || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Emergency Contact</span>
                <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{guard.emergencyContact || 'Not provided'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setIsForceClearOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', color: '#D97706', borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}>
                <Icon name="alert-triangle" size={16} /> Force Clear / Flag
              </button>
              <button className="btn btn-outline" onClick={() => setIsReassignOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', backgroundColor: '#F8FAFC' }}>
                <Icon name="arrows-exchange" size={16} /> Reassign Post
              </button>
            </div>
          </div>

          {/* Recent Handovers */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontWeight: 600, color: 'var(--text-main)' }}>
              <Icon name="history" size={16} color="var(--text-muted)" /> Recent Handovers
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {guard.recentShifts?.filter((s: any) => s.handoverNote).length > 0 ? (
                guard.recentShifts.filter((s: any) => s.handoverNote).slice(0, 2).map((shift: any, idx: number) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <div style={{ height: 1, backgroundColor: 'var(--border-color)' }}></div>}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{shift.postName || 'Main Gate — Entry'}</div>
                        <span style={{ fontSize: 11, color: '#00A676', backgroundColor: '#E6FBF5', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>complete</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {new Date(shift.startedAt).toLocaleDateString()} Shift Handover
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {shift.handoverNote}
                      </div>
                    </div>
                  </React.Fragment>
                ))
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No recent handover notes found.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shift History */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--text-main)' }}>
            <Icon name="calendar-week" size={18} color="var(--text-muted)" /> Shift History
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{guard.recentShifts?.length || 0} shifts</div>
        </div>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr className="table-header-row">
              <th style={{ padding: '12px 32px' }}>Date</th>
              <th style={{ padding: '12px 16px' }}>Shift</th>
              <th style={{ padding: '12px 16px' }}>Post</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Entries</th>
              <th style={{ padding: '12px 16px' }}>Check-ins</th>
              <th style={{ padding: '12px 16px' }}>Compliance</th>
              <th style={{ padding: '12px 32px' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {guard.recentShifts?.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No shift history found.</td></tr>
            ) : (
              guard.recentShifts?.map((shift: any, idx: number) => (
                <tr key={idx} className="table-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px 32px', fontSize: 13, color: 'var(--text-main)' }}>{new Date(shift.startedAt).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '16px', fontSize: 13, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {new Date(shift.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {shift.endedAt ? new Date(shift.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                  </td>
                  <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>{shift.postName || guard.lastPost?.entryPoint?.name || 'Unassigned'}</td>
                  <td style={{ padding: '16px' }}>
                    <span className="status-badge-modern" style={{ backgroundColor: shift.endedAt ? '#E6FBF5' : '#FEF3C7', color: shift.endedAt ? '#00A676' : '#D97706' }}>
                      {shift.endedAt ? 'completed' : 'in progress'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontSize: 13, fontWeight: 600 }}>{shift.totalEntries || 0}</td>
                  <td style={{ padding: '16px', fontSize: 13, fontWeight: 600 }}>{shift.totalIncidents || 0}</td>
                  <td style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#00C896' }}>{shift.compliance || 100}%</td>
                  <td style={{ padding: '16px 32px', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                    {shift.handoverNote || 'No notes left.'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay" onClick={() => !editSaving && setIsEditOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Edit Guard Profile</h3>
                <p className="modal-subtitle">Update basic details for this guard.</p>
              </div>
              <button className="modal-close" onClick={() => setIsEditOpen(false)}><Icon name="x" size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input type="text" className="form-input" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              {editError && <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{editError}</p>}
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={handleEditSubmit} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Guard Modal */}
      {isFlagModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFlagOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ color: '#D97706' }}>Flag Guard</h3>
                <p className="modal-subtitle">Log an incident against this guard.</p>
              </div>
              <button className="modal-close" onClick={() => setIsFlagOpen(false)}><Icon name="x" size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Reason</label>
                <select className="form-input" value={flagForm.reason} onChange={e => setFlagForm({...flagForm, reason: e.target.value})}>
                  <option value="Late Arrival">Late Arrival</option>
                  <option value="Sleeping on Duty">Sleeping on Duty</option>
                  <option value="Uniform Violation">Uniform Violation</option>
                  <option value="Unauthorized Access">Unauthorized Access allowed</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label">Additional Notes</label>
                <textarea className="form-input" rows={3} value={flagForm.notes} onChange={e => setFlagForm({...flagForm, notes: e.target.value})} placeholder="Describe the incident..."></textarea>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 8, backgroundColor: '#D97706' }} onClick={handleFlagSubmit}>Submit Flag</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Post Modal */}
      {isReassignModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReassignOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Reassign Post</h3>
                <p className="modal-subtitle">Move guard to a different active post.</p>
              </div>
              <button className="modal-close" onClick={() => setIsReassignOpen(false)}><Icon name="x" size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Select New Post</label>
                <select className="form-input" value={reassignPostName} onChange={e => setReassignPostName(e.target.value)}>
                  <option value="Main Gate — Entry">Main Gate — Entry</option>
                  <option value="Service Gate">Service Gate</option>
                  <option value="Basement Parking L1">Basement Parking L1</option>
                  <option value="Tower A Lobby">Tower A Lobby</option>
                </select>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={handleReassignSubmit}>Confirm Reassignment</button>
            </div>
          </div>
        </div>
      )}

      {/* Force Clear Modal */}
      {isForceClearModalOpen && (
        <div className="modal-overlay" onClick={() => setIsForceClearOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ color: '#DC2626' }}>Force Clear Shift</h3>
                <p className="modal-subtitle">Immediately end the guard's current shift.</p>
              </div>
              <button className="modal-close" onClick={() => setIsForceClearOpen(false)}><Icon name="x" size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--text-main)', lineHeight: 1.5 }}>
                Are you sure you want to force clear this shift? This will log out the guard immediately. 
                They will need to check in again to resume duties.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsForceClearOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: '#DC2626' }} onClick={handleForceClear}>Yes, Clear Shift</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Guard Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay" onClick={() => !isDeleting && setIsDeleteOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ color: '#DC2626' }}>Delete Guard</h3>
                <p className="modal-subtitle">Remove this guard from the roster.</p>
              </div>
              <button className="modal-close" onClick={() => setIsDeleteOpen(false)}><Icon name="x" size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--text-main)', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>{guard.name}</strong>? Their login will be revoked
                immediately and any active shift will be ended. Past entries and shift history are kept for records.
              </p>
              {deleteError && (
                <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{deleteError}</p>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: '#DC2626' }} onClick={handleDeleteGuard} disabled={isDeleting}>
                  {isDeleting ? 'Deleting…' : 'Yes, Delete Guard'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardProfile;
