import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

type VehicleRow = {
  id: string;
  plate: string;
  type: 'Resident' | 'Delivery' | 'Service' | 'Visitor';
  ownerName: string;
  unit: string;
  phone: string | null;
  vehicleDetails: string | null;
  entryAt: string;
  exitAt: string | null;
  status: 'present' | 'exited';
  duration: string | null;
  overstay: boolean;
  passCode: string | null;
};

type ParkingSlotRow = {
  id: string;
  code: string;
  zone: string;
  vehicle: VehicleRow | null;
};

type Summary = {
  residentOccupied: number;
  residentTotal: number;
  visitorOccupied: number;
  visitorTotal: number;
  overstays: number;
  availableSlots: number;
  currentlyPresent: VehicleRow[];
};

const TYPE_STYLE: Record<VehicleRow['type'], { bg: string; text: string }> = {
  Resident: { bg: '#E6FBF5', text: '#00A676' },
  Delivery: { bg: '#FEF3C7', text: '#B45309' },
  Service: { bg: '#F1F5F9', text: '#64748B' },
  Visitor: { bg: '#F1F5F9', text: '#64748B' },
};

const formatEntryTime = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${time} - ${date}`;
};

const TypeBadge = ({ type }: { type: VehicleRow['type'] }) => {
  const s = TYPE_STYLE[type];
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: s.bg, color: s.text }}>{type}</span>;
};

const ParkingVehicles: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'occupancy' | 'log' | 'view'>('occupancy');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [log, setLog] = useState<VehicleRow[]>([]);
  const [slots, setSlots] = useState<ParkingSlotRow[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlotRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [isCapacityOpen, setIsCapacityOpen] = useState(false);
  const [capacityForm, setCapacityForm] = useState({ residentParkingSlots: '0', visitorParkingSlots: '0' });
  const [savingCapacity, setSavingCapacity] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'occupancy') {
        const res = await fetch(`${API_BASE}/vehicles/parking/summary`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === 'success') setSummary(data.data);
      } else if (activeTab === 'log') {
        const res = await fetch(`${API_BASE}/vehicles/parking/log`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === 'success') setLog(data.data);
      } else {
        const res = await fetch(`${API_BASE}/vehicles/parking/slots`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === 'success') setSlots(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch parking data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const openCapacityEdit = () => {
    if (summary) {
      setCapacityForm({ residentParkingSlots: String(summary.residentTotal), visitorParkingSlots: String(summary.visitorTotal) });
    }
    setIsCapacityOpen(true);
  };

  const handleSaveCapacity = async () => {
    setSavingCapacity(true);
    try {
      const res = await fetch(`${API_BASE}/vehicles/parking/capacity`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentParkingSlots: Number(capacityForm.residentParkingSlots),
          visitorParkingSlots: Number(capacityForm.visitorParkingSlots),
        }),
      });
      if (res.ok) {
        setIsCapacityOpen(false);
        fetchData();
      }
    } finally {
      setSavingCapacity(false);
    }
  };

  return (
    <div style={{ padding: 24, flex: 1, backgroundColor: 'var(--bg-secondary)', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Parking Management</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Occupancy dashboard, vehicle entry/exit logs, expected duration tracking, and overstay flagging</p>
      </div>

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 24, background: '#F1F5F9', padding: 4, borderRadius: 8 }}>
        <button className={`tab-btn ${activeTab === 'occupancy' ? 'active' : ''}`} onClick={() => setActiveTab('occupancy')}>
          <Icon name="parking-circle" size={15} /> Occupancy Overview
        </button>
        <button className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
          <Icon name="car" size={15} /> Vehicle Log
        </button>
        <button className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`} onClick={() => setActiveTab('view')}>
          <Icon name="layout-grid" size={15} /> Parking View
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : activeTab === 'occupancy' ? (
        summary && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ backgroundColor: '#E6FBF5', color: '#00A676' }}><Icon name="car" size={16} /></div>
                <div className="stat-value">{summary.residentOccupied}/{summary.residentTotal}</div>
                <div className="stat-title">Resident Occupied</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}><Icon name="user-plus" size={16} /></div>
                <div className="stat-value">{summary.visitorOccupied}/{summary.visitorTotal}</div>
                <div className="stat-title">Visitor Occupied</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}><Icon name="clock" size={16} /></div>
                <div className="stat-value">{summary.overstays}</div>
                <div className="stat-title">Overstays</div>
              </div>
              <div className="stat-card" style={{ position: 'relative' }}>
                <div className="stat-icon" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}><Icon name="parking-circle" size={16} /></div>
                <div className="stat-value">{summary.availableSlots}</div>
                <div className="stat-title">Available Slots</div>
                <button onClick={openCapacityEdit} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
                  Edit
                </button>
              </div>
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Currently Present ({summary.currentlyPresent.length})</h3>
            <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="table-header-row">
                    {['Plate', 'Type', 'Owner / Unit', 'Entry Time', 'Duration', 'Flags'].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.currentlyPresent.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No vehicles currently on the property.</td></tr>
                  ) : summary.currentlyPresent.map(v => (
                    <tr key={v.id} className="table-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px', fontSize: 13, fontFamily: 'monospace' }}>{v.plate}</td>
                      <td style={{ padding: '14px 20px' }}><TypeBadge type={v.type} /></td>
                      <td style={{ padding: '14px 20px', fontSize: 13 }}>{v.ownerName} <span style={{ color: 'var(--text-muted)' }}>{v.unit}</span></td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{formatEntryTime(v.entryAt)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13 }}>{v.duration ?? '—'}</td>
                      <td style={{ padding: '14px 20px' }}>
                        {v.overstay && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: '#FEF3C7', color: '#B45309' }}>Overstay</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : activeTab === 'log' ? (
        <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header-row">
                {['Plate', 'Type', 'Owner / Unit', 'Entry', 'Exit', 'Status', 'Pass'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No vehicle entries logged yet.</td></tr>
              ) : log.map(v => (
                <tr key={v.id} className="table-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontFamily: 'monospace' }}>{v.plate}</td>
                  <td style={{ padding: '14px 20px' }}><TypeBadge type={v.type} /></td>
                  <td style={{ padding: '14px 20px', fontSize: 13 }}>{v.ownerName} <span style={{ color: 'var(--text-muted)' }}>{v.unit}</span></td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{formatEntryTime(v.entryAt)}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{v.exitAt ? formatEntryTime(v.exitAt) : '—'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className={`status-badge-modern ${v.status === 'present' ? 'status-on-post-modern' : 'status-offline-modern'}`}>{v.status}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{v.passCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Basement Parking &mdash; B1</h3>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#E6FBF5', border: '1px solid #A7F3D0', display: 'inline-block' }} /> Available</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', display: 'inline-block' }} /> Occupied</span>
            </div>
          </div>

          {slots.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No parking slots configured. Set resident/visitor capacity on the Occupancy Overview tab first.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 12 }}>
              {slots.map(slot => {
                const occupied = !!slot.vehicle;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px',
                      borderRadius: 8, cursor: 'pointer',
                      backgroundColor: occupied ? '#FEE2E2' : '#E6FBF5',
                      border: `1px solid ${occupied ? '#FCA5A5' : '#A7F3D0'}`,
                      color: occupied ? '#B91C1C' : '#00875A',
                    }}
                  >
                    <Icon name="car" size={20} />
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{slot.code}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 20, padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Click on any parking slot to view detailed information and vehicle history.
          </div>
        </div>
      )}

      {selectedSlot && (
        <div className="modal-overlay" onClick={() => setSelectedSlot(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Slot {selectedSlot.code}</h3>
                <p className="modal-subtitle">{selectedSlot.vehicle ? 'Currently occupied' : 'Available'}</p>
              </div>
              <button className="modal-close" onClick={() => setSelectedSlot(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body">
              {selectedSlot.vehicle ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{selectedSlot.vehicle.plate}</span>
                    <TypeBadge type={selectedSlot.vehicle.type} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-main)' }}>
                    <Icon name="building-skyscraper" size={14} color="var(--text-muted)" /> {selectedSlot.vehicle.ownerName} &middot; {selectedSlot.vehicle.unit}
                  </div>
                  {selectedSlot.vehicle.vehicleDetails && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-main)' }}>
                      <Icon name="tag" size={14} color="var(--text-muted)" /> {selectedSlot.vehicle.vehicleDetails}
                    </div>
                  )}
                  {selectedSlot.vehicle.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-main)' }}>
                      <Icon name="phone" size={14} color="var(--text-muted)" /> {selectedSlot.vehicle.phone}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Parked since {formatEntryTime(selectedSlot.vehicle.entryAt)}</div>
                  {selectedSlot.vehicle.overstay && (
                    <span style={{ alignSelf: 'flex-start', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: '#FEF3C7', color: '#B45309' }}>Overstay</span>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>This slot is empty and ready for the next vehicle.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isCapacityOpen && (
        <div className="modal-overlay" onClick={() => setIsCapacityOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Parking Capacity</h3>
                <p className="modal-subtitle">Total slots reserved for residents vs. visitors</p>
              </div>
              <button className="modal-close" onClick={() => setIsCapacityOpen(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Resident slots</label>
                <input type="number" min={0} className="form-input" value={capacityForm.residentParkingSlots}
                  onChange={e => setCapacityForm({ ...capacityForm, residentParkingSlots: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Visitor slots</label>
                <input type="number" min={0} className="form-input" value={capacityForm.visitorParkingSlots}
                  onChange={e => setCapacityForm({ ...capacityForm, visitorParkingSlots: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsCapacityOpen(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveCapacity} disabled={savingCapacity}>
                  {savingCapacity ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingVehicles;
