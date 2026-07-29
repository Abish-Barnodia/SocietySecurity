import React, { useState, useEffect } from 'react';
import { Search, Filter, Upload, Download, Plus, MoreVertical, Key, Megaphone, Users, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/v1';

const ResidentDirectory = () => {
  const [activeTab, setActiveTab] = useState('directory');
  const [residents, setResidents] = useState<any[]>([]);
  const [passes, setPasses] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);

  // New Resident Form State
  const [newResidentForm, setNewResidentForm] = useState({
    name: '', unit: '', tower: 'Tower A', floor: '1', members: '1', phone: '', email: '', isPrimary: true
  });

  // Action Modals State
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [selectedResidentForDetails, setSelectedResidentForDetails] = useState<any>(null);
  
  const [isManagePassesOpen, setIsManagePassesOpen] = useState(false);
  const [selectedResidentForPasses, setSelectedResidentForPasses] = useState<any>(null);
  
  const [isComposeBroadcastOpen, setIsComposeBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', targetScope: 'ALL_RESIDENTS' });

  // UI Polish States
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [suspendConfirmId, setSuspendConfirmId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getAuthToken = () => localStorage.getItem('accessToken') || '';

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${getAuthToken()}` };
      
      if (activeTab === 'directory') {
        const res = await fetch(`${API_BASE}/residents`, { headers });
        const data = await res.json();
        if (data.status === 'success') setResidents(data.data);
      } else if (activeTab === 'passes') {
        const res = await fetch(`${API_BASE}/passes`, { headers });
        const data = await res.json();
        if (data.status === 'success') setPasses(data.data.passes); // Note: paginated in backend
      } else if (activeTab === 'broadcasts') {
        const res = await fetch(`${API_BASE}/broadcasts`, { headers });
        const data = await res.json();
        if (data.status === 'success') setBroadcasts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddResident = async () => {
    try {
      // ponytail: Minimal mock unit logic. If unit doesn't exist, this fails in backend, 
      // but we assume there's a script or we gracefully fail.
      // In a real app we'd fetch units and have a dropdown, but for now we'll just pass unitId = 123
      const res = await fetch(`${API_BASE}/residents`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newResidentForm.name,
          phone: newResidentForm.phone,
          unit: newResidentForm.unit,
          tower: newResidentForm.tower,
          floor: newResidentForm.floor,
          isPrimary: newResidentForm.isPrimary
        })
      });
      if (res.ok) {
        setIsAddResidentOpen(false);
        setNewResidentForm({ name: '', unit: '', tower: 'Tower A', floor: '1', members: '1', phone: '', email: '', isPrimary: true });
        showToast('Resident added successfully', 'success');
        fetchData();
      } else {
        const errorData = await res.json();
        showToast(`Failed to add resident: ${errorData.message || 'Unknown error'}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('An unexpected error occurred', 'error');
    }
  };

  const confirmSuspend = async () => {
    if (!suspendConfirmId) return;
    try {
      const res = await fetch(`${API_BASE}/residents/${suspendConfirmId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (res.ok) {
        showToast('Resident suspended successfully', 'success');
        setSuspendConfirmId(null);
        fetchData(); // refresh the list
      } else {
        const errorData = await res.json();
        showToast(`Failed to suspend resident: ${errorData.message || 'Unknown error'}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('An unexpected error occurred', 'error');
    }
  };

  const handleSuspend = (residentId: string) => {
    setSuspendConfirmId(residentId);
  };

  const handleViewDetails = (resident: any) => {
    setSelectedResidentForDetails(resident);
    setIsViewDetailsOpen(true);
  };

  const handleManagePasses = (resident: any) => {
    setSelectedResidentForPasses(resident);
    setIsManagePassesOpen(true);
  };

  const handleExportCSV = () => {
    if (residents.length === 0) {
      showToast("No residents available to export.", 'error');
      return;
    }

    showToast("CSV export started. The file will download shortly.", 'success');
    
    // Create CSV header
    let csvContent = "Name,Phone,Unit,Tower,Floor,Status,Move-in Date\n";
    
    // Add rows
    residents.forEach(r => {
      const name = `"${r.name || ''}"`;
      const phone = `"${r.user?.phone || ''}"`;
      const unit = `"${r.unit?.unitNumber || ''}"`;
      const tower = `"${r.unit?.tower || ''}"`;
      const floor = `"${r.unit?.floor || ''}"`;
      const status = `"${r.user?.isActive ? 'Active' : 'Suspended'}"`;
      const date = `"${new Date(r.createdAt).toLocaleDateString()}"`;
      
      csvContent += `${name},${phone},${unit},${tower},${floor},${status},${date}\n`;
    });

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `resident_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        
        if (lines.length < 2) {
          showToast("CSV file must contain a header and at least one row.", 'error');
          return;
        }

        showToast("Processing CSV...", 'success');
        setLoading(true);

        let successCount = 0;
        let failCount = 0;

        // Simple CSV parser assuming format: Name, Phone, Unit, Tower, Floor
        // We always skip the first line (header)
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(s => s.trim());
          if (cols.length < 3) continue; // Need at least name, phone, unit
          
          const name = cols[0];
          const phone = cols[1];
          const unitNumber = cols[2];
          const tower = cols[3] || 'Tower A';
          const floor = parseInt(cols[4]) || 1;

          try {
            const res = await fetch(`${API_BASE}/residents`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ name, phone, unitNumber, tower, floor, isPrimary: true })
            });
            if (res.ok) successCount++;
            else failCount++;
          } catch (err) {
            failCount++;
          }
        }

        showToast(`Import complete! Added ${successCount} residents. ${failCount > 0 ? `(${failCount} failed)` : ''}`, successCount > 0 ? 'success' : 'error');
        fetchData(); // This will also set loading back to false
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleComposeBroadcast = async () => {
    try {
      const res = await fetch(`${API_BASE}/broadcasts`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(broadcastForm)
      });
      if (res.ok) {
        setIsComposeBroadcastOpen(false);
        setBroadcastForm({ title: '', body: '', targetScope: 'ALL_RESIDENTS' });
        showToast('Broadcast sent successfully!', 'success');
        fetchData();
      } else {
        const errorData = await res.json();
        showToast(`Failed to broadcast: ${errorData.message || 'Unknown error'}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('An unexpected error occurred', 'error');
    }
  };

  const tabs = [
    { id: 'directory', label: 'Directory', icon: <Users size={16} /> },
    { id: 'passes', label: 'Credentials & Passes', icon: <Key size={16} /> },
    { id: 'broadcasts', label: 'Broadcast History', icon: <Megaphone size={16} /> },
  ];

  return (
    <div style={{ padding: 24, flex: 1, backgroundColor: 'var(--bg-secondary)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Resident Directory</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Account management, credential auditing, pass oversight, and broadcast composition</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'white' }} onClick={handleExportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'white' }} onClick={handleImportCSV}>
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setIsAddResidentOpen(true)}>
            <Plus size={16} /> Add Resident
          </button>
        </div>
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
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2 className="spin" size={32} color="var(--primary)" />
        </div>
      ) : (
        <>
          {/* DIRECTORY TAB */}
          {activeTab === 'directory' && (
            <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                  <input type="text" className="form-input" placeholder="Search residents or units..." style={{ paddingLeft: 36, backgroundColor: 'white' }} />
                </div>
                <select className="form-input" style={{ width: 'auto', backgroundColor: 'white' }}>
                  <option>All Towers</option>
                  <option>Tower A</option>
                  <option>Tower B</option>
                </select>
                <select className="form-input" style={{ width: 'auto', backgroundColor: 'white' }}>
                  <option>All Status</option>
                  <option>Active</option>
                  <option>Suspended</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
                {residents.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No residents found. Try adding one!</p>
                ) : (
                  residents.map(resident => (
                    <div key={resident.id} style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 600 }}>{resident.name}</h3>
                          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{resident.unit?.unitNumber ? `Unit ${resident.unit.unitNumber}` : 'Unassigned Unit'}</p>
                        </div>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, 
                          backgroundColor: resident.user?.isActive ? '#E0F2FE' : '#FEE2E2', 
                          color: resident.user?.isActive ? '#0369A1' : '#991B1B' 
                        }}>
                          {resident.user?.isActive ? 'active' : 'suspended'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Occupancy</div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>Owner</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Members</div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>1</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Active Passes</div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>0</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Since</div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{new Date(resident.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                        {resident.user?.phone || 'No Phone'}
                      </div>

                      <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                        <button onClick={() => handleViewDetails(resident)} style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>View Details</button>
                        <button onClick={() => handleManagePasses(resident)} style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>Manage Passes</button>
                        {resident.user?.isActive ? (
                          <button onClick={() => handleSuspend(resident.id)} style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: 'none', color: '#D97706', cursor: 'pointer' }}>Suspend</button>
                        ) : (
                          <button disabled style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'not-allowed' }}>Suspended</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* PASSES TAB */}
          {activeTab === 'passes' && (
            <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: '#F8FAFC' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Pass ID</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Resident / Unit</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Visitor</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {passes.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No passes found.</td>
                    </tr>
                  ) : (
                    passes.map(pass => (
                      <tr key={pass.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px 20px', fontSize: 13, fontFamily: 'monospace' }}>PASS-{pass.id.slice(-4).toUpperCase()}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>
                          <div style={{ fontWeight: 500 }}>{pass.resident?.name || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pass.unit?.unitNumber || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>{pass.visitorName}</td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, backgroundColor: '#F1F5F9', color: '#475569' }}>
                            {pass.type}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>
                           <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, backgroundColor: pass.status === 'ACTIVE' ? '#E0F2FE' : '#FEF3C7', color: pass.status === 'ACTIVE' ? '#0369A1' : '#B45309' }}>
                            {pass.status.toLowerCase()}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: 13 }}>
                          {new Date(pass.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* BROADCASTS TAB */}
          {activeTab === 'broadcasts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {broadcasts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No broadcasts found.</p>
              ) : (
                broadcasts.map(broadcast => (
                  <div key={broadcast.id} style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{broadcast.title}</h3>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, backgroundColor: '#FEF3C7', color: '#B45309' }}>
                        important
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      By {broadcast.sentBy} • {new Date(broadcast.sentAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-main)', lineHeight: 1.5 }}>
                      {broadcast.body}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} /> {broadcast.targetScope}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#00C896' }}></span> sent</div>
                    </div>
                  </div>
                ))
              )}
              
              <button className="btn btn-outline" style={{ marginTop: 16, alignSelf: 'center', backgroundColor: 'white' }} onClick={() => setIsComposeBroadcastOpen(true)}>
                + Compose New Broadcast
              </button>
            </div>
          )}
        </>
      )}

      {/* ADD RESIDENT MODAL */}
      {isAddResidentOpen && (
        <div className="modal-overlay" onClick={() => setIsAddResidentOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add New Resident</h3>
                <p className="modal-subtitle">Create a household account and assign unit</p>
              </div>
              <button className="modal-close" onClick={() => setIsAddResidentOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Household Name</label>
                <input type="text" className="form-input" placeholder="e.g. Sharma Family" value={newResidentForm.name} onChange={e => setNewResidentForm({...newResidentForm, name: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Unit</label>
                  <input type="text" className="form-input" placeholder="e.g. A-501" value={newResidentForm.unit} onChange={e => setNewResidentForm({...newResidentForm, unit: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Tower</label>
                  <select className="form-input" value={newResidentForm.tower} onChange={e => setNewResidentForm({...newResidentForm, tower: e.target.value})}>
                    <option>Tower A</option>
                    <option>Tower B</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Floor</label>
                  <input type="text" className="form-input" value={newResidentForm.floor} onChange={e => setNewResidentForm({...newResidentForm, floor: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Members</label>
                  <input type="text" className="form-input" value={newResidentForm.members} onChange={e => setNewResidentForm({...newResidentForm, members: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Phone</label>
                  <input type="text" className="form-input" placeholder="+91 98xxx xxxxx" value={newResidentForm.phone} onChange={e => setNewResidentForm({...newResidentForm, phone: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" placeholder="family@email.com" value={newResidentForm.email} onChange={e => setNewResidentForm({...newResidentForm, email: e.target.value})} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsAddResidentOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddResident}>Create Resident</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* VIEW DETAILS MODAL */}
      {isViewDetailsOpen && selectedResidentForDetails && (
        <div className="modal-overlay" onClick={() => setIsViewDetailsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 500, padding: 0 }}>
            <div className="modal-header" style={{ padding: '24px 24px 16px', borderBottom: 'none' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: 18, color: '#111827' }}>Resident Details</h3>
              </div>
              <button className="modal-close" onClick={() => setIsViewDetailsOpen(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ padding: '0 24px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Name</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>{selectedResidentForDetails.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Unit</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>{selectedResidentForDetails.unit?.unitNumber} — Tower {selectedResidentForDetails.unit?.tower || 'A'}, Floor {selectedResidentForDetails.unit?.floor || 1}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Status</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>{selectedResidentForDetails.user?.isActive ? 'Active' : 'Suspended'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Occupancy</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>Owner</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Members</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>1</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Active Passes</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Total Passes</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Move-in</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>{new Date(selectedResidentForDetails.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Phone</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>{selectedResidentForDetails.user?.phone || 'No Phone'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Email</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>Not Provided</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <button className="btn btn-primary" style={{ backgroundColor: '#008B8B', borderColor: '#008B8B', padding: '8px 24px', fontWeight: 600, fontSize: 14, borderRadius: 6 }} onClick={() => setIsViewDetailsOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE PASSES MODAL */}
      {isManagePassesOpen && selectedResidentForPasses && (
        <div className="modal-overlay" onClick={() => setIsManagePassesOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 500, padding: 0 }}>
            <div className="modal-header" style={{ padding: '24px 24px 16px', borderBottom: 'none' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: 18, color: '#111827' }}>Manage Passes — {selectedResidentForPasses.name}</h3>
              </div>
              <button className="modal-close" onClick={() => setIsManagePassesOpen(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ padding: '0 24px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Active Passes</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Total Created</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 14 }}>Duress Active</span>
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 500 }}>No</span>
                </div>
                
                <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 6, padding: '16px', marginTop: 16 }}>
                  <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>
                    Pass management actions would be available here: revoke passes, create new passes, view pass history, and set expiry dates.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                <button style={{ backgroundColor: 'transparent', border: 'none', color: '#4B5563', padding: '8px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }} onClick={() => setIsManagePassesOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ backgroundColor: '#008B8B', borderColor: '#008B8B', padding: '8px 24px', fontWeight: 600, fontSize: 14, borderRadius: 6 }} onClick={() => setIsManagePassesOpen(false)}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPOSE BROADCAST MODAL */}
      {isComposeBroadcastOpen && (
        <div className="modal-overlay" onClick={() => setIsComposeBroadcastOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Compose Broadcast</h3>
                <p className="modal-subtitle">Send an announcement to residents</p>
              </div>
              <button className="modal-close" onClick={() => setIsComposeBroadcastOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Title</label>
                <input type="text" className="form-input" placeholder="e.g. Water Supply Interruption" value={broadcastForm.title} onChange={e => setBroadcastForm({...broadcastForm, title: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Message</label>
                <textarea className="form-input" placeholder="Enter your message..." style={{ height: 100, resize: 'none' }} value={broadcastForm.body} onChange={e => setBroadcastForm({...broadcastForm, body: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Target Scope</label>
                <select className="form-input" value={broadcastForm.targetScope} onChange={e => setBroadcastForm({...broadcastForm, targetScope: e.target.value})}>
                  <option value="ALL_RESIDENTS">All Residents</option>
                  <option value="TOWER_A">Tower A Only</option>
                  <option value="TOWER_B">Tower B Only</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsComposeBroadcastOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: '#D97706', borderColor: '#D97706' }} onClick={handleComposeBroadcast}>Send Broadcast</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* CONFIRM SUSPEND MODAL */}
      {suspendConfirmId && (
        <div className="modal-overlay" onClick={() => setSuspendConfirmId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Suspend Resident</h3>
                <p className="modal-subtitle" style={{ color: '#DC2626' }}>Warning: This action cannot be undone.</p>
              </div>
              <button className="modal-close" onClick={() => setSuspendConfirmId(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-main)' }}>
                Are you sure you want to suspend this resident? They will lose access to the app, and all their active passes will be invalidated.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setSuspendConfirmId(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: '#DC2626', borderColor: '#DC2626', color: 'white' }} onClick={confirmSuspend}>Yes, Suspend</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          backgroundColor: toast.type === 'error' ? '#FEE2E2' : '#DCFCE7',
          color: toast.type === 'error' ? '#991B1B' : '#166534',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 9999,
          border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#86EFAC'}`,
          fontWeight: 500,
          fontSize: 14,
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ResidentDirectory;
