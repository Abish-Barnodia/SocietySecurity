import { useState, useEffect, useMemo } from 'react';
import Icon from './Icon';
import EmptyState from './EmptyState';
import PasswordInput from './PasswordInput';
import { API_BASE } from './config';

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  isPrimary: boolean;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Family {
  unitId: string;
  familyName: string | null;
  apartmentNumber: string;
  tower: string;
  floor: number;
  totalMembers: number;
  primaryResident: { id: string; name: string; phone: string | null; email: string | null } | null;
  members: FamilyMember[];
}

const ResidentDirectory = () => {
  const [activeTab, setActiveTab] = useState('directory');
  const [families, setFamilies] = useState<Family[]>([]);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [resolvingComplaintId, setResolvingComplaintId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [towerFilter, setTowerFilter] = useState('All Towers');

  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);
  const [editFamilyUnitId, setEditFamilyUnitId] = useState<string | null>(null);
  const blankResidentForm = () => ({
    familyName: '', unit: '', tower: 'Tower A', floor: '1',
    members: [{ name: '', phone: '', email: '', password: '', relationship: 'Primary', isPrimary: true }]
  });
  const [newResidentForm, setNewResidentForm] = useState<{
    familyName: string;
    unit: string;
    tower: string;
    floor: string;
    members: Array<{ id?: string; name: string; phone: string; email: string; password: string; relationship: string; isPrimary: boolean }>;
  }>(blankResidentForm());

  // Closing the modal via X/overlay/Cancel used to only clear editFamilyUnitId,
  // not the form fields themselves — so the next "Add Household" click (which
  // only sets isAddResidentOpen(true)) would reopen with the last-edited
  // family's data still sitting in the fields. Route every close and the
  // "Add" open through here so the form is always reset first.
  const closeResidentModal = () => {
    setIsAddResidentOpen(false);
    setEditFamilyUnitId(null);
    setNewResidentForm(blankResidentForm());
  };
  const openAddResidentModal = () => {
    setEditFamilyUnitId(null);
    setNewResidentForm(blankResidentForm());
    setIsAddResidentOpen(true);
  };

  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [isFamilyDetailsOpen, setIsFamilyDetailsOpen] = useState(false);

  const [isAddAmenityOpen, setIsAddAmenityOpen] = useState(false);
  const [editAmenityId, setEditAmenityId] = useState<string | null>(null);
  const [amenityForm, setAmenityForm] = useState({ name: '', capacity: '10', openTime: '06:00', closeTime: '22:00', status: 'AVAILABLE' });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [suspendConfirmUnitId, setSuspendConfirmUnitId] = useState<string | null>(null);

  const [workersFamily, setWorkersFamily] = useState<Family | null>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<any | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getAuthToken = () => localStorage.getItem('accessToken') || '';

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${getAuthToken()}` };
      if (activeTab === 'directory') {
        const res = await fetch(`${API_BASE}/residents`, { headers });
        const data = await res.json();
        if (data.status === 'success') setFamilies(data.data);
      } else if (activeTab === 'amenities') {
        const res = await fetch(`${API_BASE}/amenities`, { headers });
        const data = await res.json();
        if (data.status === 'success') setAmenities(data.data);
      } else if (activeTab === 'complaints') {
        const res = await fetch(`${API_BASE}/complaints`, { headers });
        const data = await res.json();
        if (data.status === 'success') setComplaints(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  // Keep the complaints queue and family directory live while open —
  // residents add/remove household members and file complaints from the app
  // in real time, and the manager shouldn't have to switch tabs away and
  // back (or refresh) to see a change land.
  useEffect(() => {
    if (activeTab !== 'complaints' && activeTab !== 'directory') return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleResolveComplaint = async (id: string) => {
    setResolvingComplaintId(id);
    try {
      const res = await fetch(`${API_BASE}/complaints/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      if (res.ok) {
        const data = await res.json();
        setComplaints(prev => prev.map(c => c.id === id ? data.data : c));
        showToast('Complaint marked resolved', 'success');
      } else {
        const d = await res.json();
        showToast(`Failed: ${d.message || 'Unknown error'}`, 'error');
      }
    } catch {
      showToast('An unexpected error occurred', 'error');
    } finally {
      setResolvingComplaintId(null);
    }
  };

  const uniqueTowers = useMemo(() => {
    const towers = new Set(families.map(f => f.tower));
    return ['All Towers', ...Array.from(towers).sort()];
  }, [families]);

  const filteredFamilies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return families.filter(f => {
      const towerMatch = towerFilter === 'All Towers' || f.tower === towerFilter;
      if (!towerMatch) return false;
      if (!q) return true;
      return (
        f.familyName?.toLowerCase().includes(q) ||
        f.apartmentNumber.toLowerCase().includes(q) ||
        f.primaryResident?.name.toLowerCase().includes(q) ||
        f.members.some(m => m.name.toLowerCase().includes(q))
      );
    });
  }, [families, searchQuery, towerFilter]);

  const displayName = (f: Family) => f.familyName || `Unit ${f.apartmentNumber} Family`;
  const familyIsActive = (f: Family) => f.members.some(m => m.isActive);

  const handleAddResident = async () => {
    if (!newResidentForm.unit.trim()) { showToast('Unit number is required', 'error'); return; }
    const primary = newResidentForm.members[0];
    if (!primary.name.trim()) { showToast('Primary member name is required', 'error'); return; }
    if (!primary.phone && !primary.email) { showToast('Primary member needs a phone or email', 'error'); return; }
    for (const m of newResidentForm.members) {
      if (!m.id && (!m.password || m.password.length < 6)) {
        showToast(`Password for ${m.name || 'a new member'} must be at least 6 characters`, 'error');
        return;
      }
      if (m.id && m.password && m.password.length < 6) {
        showToast(`Password for ${m.name} must be at least 6 characters`, 'error');
        return;
      }
    }
    try {
      const url = editFamilyUnitId ? `${API_BASE}/residents/families/${editFamilyUnitId}` : `${API_BASE}/residents/household`;
      const method = editFamilyUnitId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
        body: JSON.stringify({
          familyName: newResidentForm.familyName || undefined,
          unit: newResidentForm.unit,
          tower: newResidentForm.tower,
          floor: newResidentForm.floor,
          members: newResidentForm.members.map(m => ({ ...m, phone: m.phone || undefined, email: m.email || undefined, id: m.id || undefined }))
        })
      });
      const data = await res.json();
      if (res.ok) {
        closeResidentModal();
        showToast(editFamilyUnitId ? 'Household updated successfully!' : 'Household added successfully!', 'success');
        if (isFamilyDetailsOpen && editFamilyUnitId) {
          setIsFamilyDetailsOpen(false); // Close details modal to refresh
        }
        fetchData();
      } else {
        showToast(data.message || 'Error saving household', 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    }
  };

  const confirmSuspendFamily = async () => {
    if (!suspendConfirmUnitId) return;
    const family = families.find(f => f.unitId === suspendConfirmUnitId);
    if (!family) return;
    try {
      for (const member of family.members) {
        await fetch(`${API_BASE}/residents/${member.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
      }
      showToast('Family suspended', 'success');
      setSuspendConfirmUnitId(null);
      fetchData();
    } catch (e) { showToast('An unexpected error occurred', 'error'); }
  };

  const openWorkers = async (family: Family) => {
    setWorkersFamily(family);
    setSelectedWorker(null);
    setWorkersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/domestic-workers/unit/${family.unitId}`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
      const data = await res.json();
      setWorkers(res.ok ? (data.data || []) : []);
    } catch (e) {
      setWorkers([]);
    } finally {
      setWorkersLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (families.length === 0) { showToast('No families to export', 'error'); return; }
    let csv = 'Family Name,Apartment,Tower,Floor,Primary Resident,Total Members,Phone\n';
    families.forEach(f => {
      csv += `"${displayName(f)}","${f.apartmentNumber}","${f.tower}","${f.floor}","${f.primaryResident?.name || ''}","${f.totalMembers}","${f.primaryResident?.phone || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `resident_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast('CSV exported', 'success');
  };

  const handleSaveAmenity = async () => {
    if (!amenityForm.name.trim()) { showToast('Amenity name is required', 'error'); return; }
    try {
      const url = editAmenityId ? `${API_BASE}/amenities/${editAmenityId}` : `${API_BASE}/amenities`;
      const res = await fetch(url, {
        method: editAmenityId ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...amenityForm, capacity: Number(amenityForm.capacity) })
      });
      if (res.ok) {
        setIsAddAmenityOpen(false);
        setEditAmenityId(null);
        setAmenityForm({ name: '', capacity: '10', openTime: '06:00', closeTime: '22:00', status: 'AVAILABLE' });
        showToast(editAmenityId ? 'Amenity updated' : 'Amenity added', 'success');
        fetchData();
      } else { const d = await res.json(); showToast(`Failed: ${d.message || 'Unknown error'}`, 'error'); }
    } catch (e) { showToast('An unexpected error occurred', 'error'); }
  };

  const openEditAmenity = (amenity: any) => {
    setEditAmenityId(amenity.id);
    setAmenityForm({ name: amenity.name, capacity: String(amenity.capacity), openTime: amenity.openTime, closeTime: amenity.closeTime, status: amenity.status });
    setIsAddAmenityOpen(true);
  };

  const tabs = [
    { id: 'directory', label: 'Directory', icon: <Icon name="users" size={16} /> },
    { id: 'amenities', label: 'Amenities', icon: <Icon name="building-skyscraper" size={16} /> },
    { id: 'complaints', label: 'Complaints', icon: <Icon name="message-exclamation" size={16} /> },
  ];

  return (
    <div style={{ padding: 24, flex: 1, backgroundColor: 'var(--bg-secondary)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Resident Directory</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Family management, credential auditing, pass oversight, and broadcast composition</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'white' }} onClick={handleExportCSV}>
            <Icon name="download" size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={openAddResidentModal}>
            <Icon name="plus" size={16} /> Add Household
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 16px', backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
            border: activeTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
            borderRadius: 8, fontWeight: activeTab === tab.id ? 600 : 500,
            color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
          }}>
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
          {activeTab === 'directory' && (
            <>
              {/* Search & Filters */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                  <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                  <input type="text" className="form-input" placeholder="Search by family, unit, or member name..."
                    style={{ paddingLeft: 36, backgroundColor: 'white' }}
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <select className="form-input" style={{ width: 'auto', backgroundColor: 'white' }}
                  value={towerFilter} onChange={e => setTowerFilter(e.target.value)}>
                  {uniqueTowers.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
                {[
                  { icon: <Icon name="home" size={16} color="var(--primary)" />, value: filteredFamilies.length, label: 'Families' },
                  { icon: <Icon name="users" size={16} color="var(--primary)" />, value: filteredFamilies.reduce((s, f) => s + f.totalMembers, 0), label: 'Total Residents' },
                  { icon: <Icon name="building-skyscraper" size={16} color="var(--primary)" />, value: uniqueTowers.length - 1, label: 'Towers' },
                ].map(stat => (
                  <div key={stat.label} style={{ backgroundColor: 'white', borderRadius: 10, border: '1px solid var(--border-color)', padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
                    {stat.icon}
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{stat.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Family Cards */}
              {filteredFamilies.length === 0 ? (
                <EmptyState icon="users" message={searchQuery ? 'No families match your search.' : 'No families yet. Click "Add Household" to get started!'} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
                  {filteredFamilies.map(family => {
                    const active = familyIsActive(family);
                    return (
                      <div key={family.unitId}
                        style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                        onClick={() => { setSelectedFamily(family); setIsFamilyDetailsOpen(true); }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <div>
                            <h3 style={{ margin: '0 0 5px 0', fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{displayName(family)}</h3>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Icon name="home" size={11} /> Unit {family.apartmentNumber} &middot; {family.tower}
                            </p>
                          </div>
                          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: active ? '#E0F2FE' : '#FEE2E2', color: active ? '#0369A1' : '#991B1B' }}>
                            {active ? 'active' : 'suspended'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                          <div style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Primary Resident</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{family.primaryResident?.name || '-'}</div>
                          </div>
                          <div style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Members</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{family.totalMembers}</div>
                          </div>
                        </div>

                        {/* Member name pills */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, minHeight: 26 }}>
                          {family.members.slice(0, 3).map(m => (
                            <span key={m.id} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, backgroundColor: m.isPrimary ? '#EDE9FE' : '#F1F5F9', color: m.isPrimary ? '#6D28D9' : '#64748B' }}>
                              {m.isPrimary && '\u2605 '}{m.name}
                            </span>
                          ))}
                          {family.members.length > 3 && <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, backgroundColor: '#F1F5F9', color: '#94A3B8' }}>+{family.members.length - 3} more</span>}
                        </div>

                        <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid var(--border-color)', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedFamily(family); setIsFamilyDetailsOpen(true); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                              View Family <Icon name="chevron-right" size={14} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); openWorkers(family); }}
                              title="Domestic workers registered by this household"
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: 6, cursor: 'pointer' }}>
                              <Icon name="users-group" size={14} /> Workers
                            </button>
                          </div>
                          {active ? (
                            <button onClick={e => { e.stopPropagation(); setSuspendConfirmUnitId(family.unitId); }}
                              style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #D97706', color: '#D97706', borderRadius: 6, cursor: 'pointer' }}>
                              Suspend
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Suspended</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'amenities' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => { setEditAmenityId(null); setAmenityForm({ name: '', capacity: '10', openTime: '06:00', closeTime: '22:00', status: 'AVAILABLE' }); setIsAddAmenityOpen(true); }}>
                  <Icon name="plus" size={16} /> Add Amenity
                </button>
              </div>
              {amenities.length === 0 ? (
                <EmptyState icon="building-skyscraper" message="No amenities added yet. Residents won't see any until you add one." compact />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {amenities.map(a => (
                    <div key={a.id} style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{a.name}</h3>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          backgroundColor: a.status === 'AVAILABLE' ? '#DCFCE7' : a.status === 'MAINTENANCE' ? '#FEE2E2' : '#F1F5F9',
                          color: a.status === 'AVAILABLE' ? '#15803D' : a.status === 'MAINTENANCE' ? '#991B1B' : '#475569',
                        }}>
                          {a.status.toLowerCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{a.openTime} &ndash; {a.closeTime}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Capacity: {a.capacity} people</div>
                      <button
                        onClick={() => openEditAmenity(a)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 6, cursor: 'pointer' }}>
                        <Icon name="pencil" size={13} /> Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'complaints' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {complaints.length === 0 ? (
                <EmptyState icon="message-exclamation" message="No complaints raised yet." compact />
              ) : complaints.map(c => {
                const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';
                return (
                  <div key={c.id} style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 600 }}>{c.title}</h3>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {c.resident?.name || 'Unknown'} &middot; {c.resident?.unit ? `${c.resident.unit.tower ? c.resident.unit.tower + ' ' : ''}${c.resident.unit.unitNumber}` : 'N/A'} &middot; {new Date(c.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, backgroundColor: '#F1F5F9', color: '#475569' }}>{c.category}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          backgroundColor: isResolved ? '#DCFCE7' : c.status === 'IN_PROGRESS' ? '#E0F2FE' : '#FEF3C7',
                          color: isResolved ? '#15803D' : c.status === 'IN_PROGRESS' ? '#0369A1' : '#B45309',
                        }}>
                          {c.status.replace('_', ' ').toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 14px 0', fontSize: 14, lineHeight: 1.5, color: 'var(--text-main)' }}>{c.description}</p>
                    {isResolved ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#15803D' }}>
                        <Icon name="check" size={14} /> Resolved
                      </div>
                    ) : (
                      <button
                        onClick={() => handleResolveComplaint(c.id)}
                        disabled={resolvingComplaintId === c.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: resolvingComplaintId === c.id ? 0.6 : 1 }}
                      >
                        <Icon name="check" size={14} /> {resolvingComplaintId === c.id ? 'Marking done...' : 'Mark Done'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== FAMILY DETAILS MODAL ===== */}
      {isFamilyDetailsOpen && selectedFamily && (
        <div className="modal-overlay" onClick={() => setIsFamilyDetailsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}
            style={{ width: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 700 }}>{displayName(selectedFamily)}</h2>
                <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="home" size={12} /> Unit {selectedFamily.apartmentNumber}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="building-skyscraper" size={12} /> {selectedFamily.tower}</span>
                  <span>Floor {selectedFamily.floor}</span>
                </div>
              </div>
              <button onClick={() => setIsFamilyDetailsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <Icon name="x" size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 28px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              {[
                { label: 'Primary Resident', value: selectedFamily.primaryResident?.name || 'â€”' },
                { label: 'Total Members', value: String(selectedFamily.totalMembers) },
                { label: 'Status', value: familyIsActive(selectedFamily) ? 'Active' : 'Suspended', color: familyIsActive(selectedFamily) ? '#059669' : '#DC2626' },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '16px 28px 20px', overflowY: 'auto', flex: 1 }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Family Members</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedFamily.members.map(member => (
                  <div key={member.id} style={{
                    padding: 16, borderRadius: 10,
                    border: `1px solid ${member.isPrimary ? '#DDD6FE' : 'var(--border-color)'}`,
                    backgroundColor: member.isPrimary ? '#FAFAFA' : 'white',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, fontWeight: 700,
                          backgroundColor: member.isPrimary ? '#EDE9FE' : '#F1F5F9',
                          color: member.isPrimary ? '#6D28D9' : '#475569',
                        }}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{member.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{member.relationship}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {member.isPrimary && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: '#EDE9FE', color: '#6D28D9' }}>Primary</span>}
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: member.isActive ? '#DCFCE7' : '#FEE2E2', color: member.isActive ? '#15803D' : '#991B1B' }}>
                          {member.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      {member.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)' }}><Icon name="phone" size={12} />{member.phone}</div>}
                      {member.email && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)' }}><Icon name="mail" size={12} />{member.email}</div>}
                      {!member.phone && !member.email && <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No contact info</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
              <button onClick={() => {
                setEditFamilyUnitId(selectedFamily.unitId);
                setNewResidentForm({
                  familyName: selectedFamily.familyName || '',
                  unit: selectedFamily.apartmentNumber,
                  tower: selectedFamily.tower,
                  floor: String(selectedFamily.floor || '1'),
                  members: selectedFamily.members.map(m => ({
                    id: m.id,
                    name: m.name,
                    phone: m.phone || '',
                    email: m.email || '',
                    password: '',
                    relationship: m.relationship,
                    isPrimary: m.isPrimary
                  }))
                });
                setIsAddResidentOpen(true);
              }}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 6, cursor: 'pointer' }}>
                Edit Family
              </button>
              {familyIsActive(selectedFamily) && (
                <button onClick={() => { setIsFamilyDetailsOpen(false); setSuspendConfirmUnitId(selectedFamily.unitId); }}
                  style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', border: '1px solid #D97706', color: '#D97706', borderRadius: 6, cursor: 'pointer' }}>
                  Suspend Family
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setIsFamilyDetailsOpen(false)} style={{ padding: '9px 24px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT HOUSEHOLD MODAL ===== */}
      {isAddResidentOpen && (
        <div className="modal-overlay" onClick={closeResidentModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editFamilyUnitId ? 'Edit Household' : 'Add New Household'}</h3>
                <p className="modal-subtitle">{editFamilyUnitId ? 'Update family details and members' : 'Create a family account and assign a unit'}</p>
              </div>
              <button className="modal-close" onClick={closeResidentModal}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '72vh', overflowY: 'auto', paddingRight: 8 }}>
              <div>
                <label className="form-label">Household / Family Name (Optional)</label>
                <input type="text" autoComplete="off" className="form-input" placeholder="e.g. Sharma Family"
                  value={newResidentForm.familyName} onChange={e => setNewResidentForm({ ...newResidentForm, familyName: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <label className="form-label">Unit Number <span style={{ color: '#DC2626' }}>*</span></label>
                  <input type="text" className="form-input" placeholder="e.g. A-501"
                    value={newResidentForm.unit} onChange={e => setNewResidentForm({ ...newResidentForm, unit: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Tower</label>
                  <select className="form-input" value={newResidentForm.tower} onChange={e => setNewResidentForm({ ...newResidentForm, tower: e.target.value })}>
                    <option>Tower A</option><option>Tower B</option><option>Tower C</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Floor</label>
                  <input type="text" className="form-input" value={newResidentForm.floor} onChange={e => setNewResidentForm({ ...newResidentForm, floor: e.target.value })} />
                </div>
              </div>

              <div style={{ marginTop: 8, borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700 }}>Family Members</h4>
                {newResidentForm.members.map((member, index) => (
                  <div key={index} style={{ backgroundColor: '#F9FAFB', padding: 16, borderRadius: 10, marginBottom: 10, position: 'relative', border: '1px solid #E5E7EB' }}>
                    {index === 0 && (
                      <div style={{ position: 'absolute', top: -1, left: 12, padding: '2px 8px', backgroundColor: '#EDE9FE', color: '#6D28D9', fontSize: 10, fontWeight: 700, borderRadius: '0 0 6px 6px' }}>
                        PRIMARY RESIDENT
                      </div>
                    )}
                    {index > 0 && (
                      <button onClick={() => { const u = [...newResidentForm.members]; u.splice(index, 1); setNewResidentForm({ ...newResidentForm, members: u }); }}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>&times;</button>
                    )}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, marginTop: index === 0 ? 14 : 0 }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Full Name <span style={{ color: '#DC2626' }}>*</span></label>
                        <input type="text" className="form-input" placeholder="Name" value={member.name}
                          onChange={e => { const u = [...newResidentForm.members]; u[index].name = e.target.value; setNewResidentForm({ ...newResidentForm, members: u }); }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Relationship</label>
                        <select className="form-input" value={member.relationship}
                          onChange={e => { const u = [...newResidentForm.members]; u[index].relationship = e.target.value; setNewResidentForm({ ...newResidentForm, members: u }); }}>
                          <option>Primary</option><option>Spouse</option><option>Child</option><option>Parent</option><option>Sibling</option><option>Other</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Phone</label>
                        <input type="text" className="form-input" placeholder="+91 98765 43210" value={member.phone}
                          onChange={e => { const u = [...newResidentForm.members]; u[index].phone = e.target.value; setNewResidentForm({ ...newResidentForm, members: u }); }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" placeholder="email@example.com" value={member.email}
                          onChange={e => { const u = [...newResidentForm.members]; u[index].email = e.target.value; setNewResidentForm({ ...newResidentForm, members: u }); }} />
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label className="form-label">Password {(!member.id) && <span style={{ color: '#DC2626' }}>*</span>}</label>
                      <PasswordInput autoComplete="new-password" className="form-input" placeholder={member.id ? "Leave blank to keep unchanged" : "Individual password (min 6 chars)"} value={member.password}
                        onChange={e => { const u = [...newResidentForm.members]; u[index].password = e.target.value; setNewResidentForm({ ...newResidentForm, members: u }); }} />
                    </div>
                  </div>
                ))}
                <button className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed', backgroundColor: 'transparent' }}
                  onClick={() => setNewResidentForm({ ...newResidentForm, members: [...newResidentForm.members, { name: '', phone: '', email: '', password: '', relationship: 'Other', isPrimary: false }] })}>
                  + Add Member
                </button>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={closeResidentModal}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddResident}>{editFamilyUnitId ? 'Save Changes' : 'Create Household'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== CONFIRM SUSPEND MODAL ===== */}
      {suspendConfirmUnitId && (
        <div className="modal-overlay" onClick={() => setSuspendConfirmUnitId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Suspend Family</h3>
                <p className="modal-subtitle" style={{ color: '#DC2626' }}>All family members will lose access.</p>
              </div>
              <button className="modal-close" onClick={() => setSuspendConfirmUnitId(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 20px 0', fontSize: 14 }}>All members in this household will lose app access and their passes will be invalidated.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setSuspendConfirmUnitId(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: '#DC2626', borderColor: '#DC2626' }} onClick={confirmSuspendFamily}>Yes, Suspend</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== DOMESTIC WORKERS MODAL ===== */}
      {workersFamily && (
        <div className="modal-overlay" onClick={() => setWorkersFamily(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div>
                {selectedWorker ? (
                  <button onClick={() => setSelectedWorker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: 0, marginBottom: 6 }}>
                    <Icon name="arrow-left" size={14} /> Back
                  </button>
                ) : null}
                <h3 className="modal-title">{selectedWorker ? selectedWorker.name : 'Domestic Workers'}</h3>
                <p className="modal-subtitle">
                  {selectedWorker ? selectedWorker.type : `Registered by ${displayName(workersFamily)} · Unit ${workersFamily.apartmentNumber}`}
                </p>
              </div>
              <button className="modal-close" onClick={() => setWorkersFamily(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {workersLoading ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0' }}>Loading…</p>
              ) : selectedWorker ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Type', value: selectedWorker.type },
                    { label: 'Phone', value: selectedWorker.phone || '—' },
                    { label: 'Address', value: selectedWorker.address || '—' },
                    { label: 'Working Days', value: (selectedWorker.workingDays || []).join(', ') || '—' },
                    { label: 'Timing', value: selectedWorker.entryTime && selectedWorker.exitTime ? `${selectedWorker.entryTime} – ${selectedWorker.exitTime}` : '—' },
                    { label: 'Govt ID', value: selectedWorker.govtIdType ? `${selectedWorker.govtIdType} · ${selectedWorker.govtIdNumber || '—'}` : '—' },
                    { label: 'Notes', value: selectedWorker.notes || '—' },
                    { label: 'Registered On', value: new Date(selectedWorker.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : workers.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0' }}>No domestic workers registered by this household yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {workers.map((w: any) => (
                    <button key={w.id} onClick={() => setSelectedWorker(w)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: '#F8FAFC', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{w.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{w.type} · {w.phone || 'No phone'}</div>
                      </div>
                      <Icon name="chevron-right" size={16} color="var(--text-muted)" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT AMENITY MODAL ===== */}
      {isAddAmenityOpen && (
        <div className="modal-overlay" onClick={() => setIsAddAmenityOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{editAmenityId ? 'Edit Amenity' : 'Add Amenity'}</h3>
                <p className="modal-subtitle">Residents see this in the amenities tab of the resident app</p>
              </div>
              <button className="modal-close" onClick={() => setIsAddAmenityOpen(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Name</label>
                <input type="text" className="form-input" placeholder="e.g. Swimming Pool"
                  value={amenityForm.name} onChange={e => setAmenityForm({ ...amenityForm, name: e.target.value })} />
              </div>
              <div className="form-row">
                <div>
                  <label className="form-label">Capacity</label>
                  <input type="number" min={1} className="form-input" value={amenityForm.capacity}
                    onChange={e => setAmenityForm({ ...amenityForm, capacity: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={amenityForm.status} onChange={e => setAmenityForm({ ...amenityForm, status: e.target.value })}>
                    <option value="AVAILABLE">Available</option>
                    <option value="MAINTENANCE">Under Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div>
                  <label className="form-label">Opens at</label>
                  <input type="time" className="form-input" value={amenityForm.openTime}
                    onChange={e => setAmenityForm({ ...amenityForm, openTime: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Closes at</label>
                  <input type="time" className="form-input" value={amenityForm.closeTime}
                    onChange={e => setAmenityForm({ ...amenityForm, closeTime: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsAddAmenityOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveAmenity}>{editAmenityId ? 'Save Changes' : 'Add Amenity'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TOAST ===== */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          backgroundColor: toast.type === 'error' ? '#FEE2E2' : '#DCFCE7',
          color: toast.type === 'error' ? '#991B1B' : '#166534',
          padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#86EFAC'}`,
          fontWeight: 500, fontSize: 14, animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ResidentDirectory;

