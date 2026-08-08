import React, { useState, useEffect } from 'react';
import { Building, ShieldCheck, CheckCircle, AlertTriangle, Key, ArrowRight, User, X, MapPin, Search } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/v1';

const EventTimeline = () => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';

  const [viewType, setViewType] = useState<'unit' | 'guard'>('unit');
  
  // Dynamic lists from DB
  const [residentList, setResidentList] = useState<any[]>([]);
  const [guardList, setGuardList] = useState<any[]>([]);

  const [selectedUnit, setSelectedUnit] = useState<string>(''); // Will hold unitNumber
  const [selectedGuard, setSelectedGuard] = useState<string>(''); // Will hold badgeNumber or id
  const [selectedPass, setSelectedPass] = useState<string | null>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Fetch initial filters (units, guards)
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${getAuthToken()}` };
        
        // ponytail: Fetches all residents to get units. Ideally, backend should have a /units endpoint.
        const resResidents = await fetch(`${API_BASE}/residents`, { headers });
        if (resResidents.ok) {
          const data = await resResidents.json();
          const validResidents = (data.data || []).filter((r: any) => r.apartmentNumber);
          setResidentList(validResidents);
          if (validResidents.length > 0) {
            setSelectedUnit(validResidents[0].apartmentNumber);
          }
        }

        const resGuards = await fetch(`${API_BASE}/guards/directory`, { headers });
        if (resGuards.ok) {
          const data = await resGuards.json();
          const guards = data.data || [];
          setGuardList(guards);
          if (guards.length > 0) {
            setSelectedGuard(guards[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch filters', error);
      }
    };
    fetchFilters();
  }, []);

  const fetchEvents = async () => {
    // Prevent fetching if selected ID is empty
    if (viewType === 'unit' && !selectedUnit) return;
    if (viewType === 'guard' && !selectedGuard) return;

    try {
      const token = getAuthToken();
      const url = viewType === 'unit' 
        ? `${API_BASE}/timeline?unitId=${selectedUnit}`
        : `${API_BASE}/timeline?guardId=${selectedGuard}`;
        
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setLastRefresh(new Date());
        setSecondsAgo(0);
      }
    } catch (error) {
      console.error('Failed to fetch timeline events', error);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000); // 10s polling
    return () => clearInterval(interval);
  }, [viewType, selectedUnit, selectedGuard]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastRefresh]);

  // Derived state for the title
  const currentResident = residentList.find(r => r.apartmentNumber === selectedUnit);
  const currentGuard = guardList.find(g => g.id === selectedGuard);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#fff', position: 'relative' }}>
      <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Event Timeline</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Per-unit and per-guard chronological event audit with linked event tracing</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#059669' }}></span>
            Live • Last refresh: {secondsAgo}s ago
          </div>
        </div>

        {/* View Type Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, backgroundColor: '#F9FAFB', padding: 4, borderRadius: 8, width: 'fit-content' }}>
          <button 
            onClick={() => setViewType('unit')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 500, fontSize: 14,
              backgroundColor: viewType === 'unit' ? 'white' : 'transparent',
              color: viewType === 'unit' ? '#111827' : '#6B7280',
              boxShadow: viewType === 'unit' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Building size={16} /> By Unit
          </button>
          <button 
            onClick={() => setViewType('guard')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 500, fontSize: 14,
              backgroundColor: viewType === 'guard' ? 'white' : 'transparent',
              color: viewType === 'guard' ? '#111827' : '#6B7280',
              boxShadow: viewType === 'guard' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <ShieldCheck size={16} /> By Guard
          </button>
        </div>

        {/* Sub-Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {viewType === 'unit' ? (
            // ponytail: Show only first 5 units for UI simplicity instead of a huge list
            residentList.slice(0, 5).map(res => (
              <button
                key={res.unitId}
                onClick={() => setSelectedUnit(res.apartmentNumber)}
                style={{
                  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  backgroundColor: selectedUnit === res.apartmentNumber ? '#008B8B' : '#F3F4F6',
                  color: selectedUnit === res.apartmentNumber ? 'white' : '#4B5563'
                }}
              >
                Unit {res.apartmentNumber} — {res.primaryResident?.name}
              </button>
            ))
          ) : (
            // ponytail: Show only first 5 guards for UI simplicity
            guardList.slice(0, 5).map(g => (
              <button 
                key={g.id}
                onClick={() => setSelectedGuard(g.id)}
                style={{ 
                  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  backgroundColor: selectedGuard === g.id ? '#008B8B' : '#F3F4F6',
                  color: selectedGuard === g.id ? 'white' : '#4B5563'
                }}
              >
                {g.name} ({g.badgeNumber})
              </button>
            ))
          )}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 24, borderBottom: '1px solid #E5E7EB', paddingBottom: 12 }}>
          {viewType === 'unit' ? `Timeline for Unit ${selectedUnit}` : `Timeline for ${currentGuard?.name || 'Guard'}`} 
          <span style={{ color: '#9CA3AF', fontWeight: 400 }}>
            — {viewType === 'unit' ? (currentResident?.primaryResident?.name || '') : (currentGuard?.badgeNumber || '')}
          </span>
        </h3>

        {/* Timeline Events */}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, backgroundColor: '#E5E7EB' }}></div>
          {events.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: 14, marginTop: 24 }}>No events found.</p>
          ) : events.map((evt, idx) => (
            <div key={evt.id || idx} style={{ display: 'flex', gap: 24, marginBottom: 32, position: 'relative' }}>
              <div style={{ 
                width: 32, height: 32, borderRadius: '50%', backgroundColor: evt.iconBg, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 
              }}>
                {evt.iconType === 'ArrowRight' && <ArrowRight size={16} color={evt.iconColor} />}
                {evt.iconType === 'CheckCircle' && <CheckCircle size={16} color={evt.iconColor} />}
                {evt.iconType === 'AlertTriangle' && <AlertTriangle size={16} color={evt.iconColor} />}
                {evt.iconType === 'XCircle' && <X size={16} color={evt.iconColor} />}
                {evt.iconType === 'Key' && <Key size={16} color={evt.iconColor} />}
              </div>
              <div style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 16, border: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: '#111827' }}>{evt.title}</h4>
                    <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{evt.time}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280' }}>{evt.type}</span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{evt.description}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#6B7280' }}>
                  {evt.guard && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={14} /> {evt.guard}</span>
                  )}
                  {evt.unit && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building size={14} /> {evt.unit}</span>
                  )}
                  {evt.gate && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} /> {evt.gate}</span>
                  )}
                  {evt.pass && (
                    <span 
                      style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#008B8B', fontWeight: 500, cursor: 'pointer' }}
                      onClick={() => setSelectedPass(evt.pass)}
                    >
                      <Key size={14} /> {evt.pass}
                    </span>
                  )}
                  {evt.linkedEvent && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4F46E5', fontWeight: 500, cursor: 'pointer' }}>
                      Linked Event
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Slide-out Pass Details */}
      {selectedPass && (
        <div style={{ 
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 400, backgroundColor: 'white', 
          boxShadow: '-4px 0 15px rgba(0,0,0,0.05)', borderLeft: '1px solid #E5E7EB',
          display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out'
        }}>
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={20} color="#0284C7" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#111827' }}>{selectedPass}</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Pass Details</p>
              </div>
            </div>
            <button onClick={() => setSelectedPass(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: '#D1FAE5', color: '#065F46' }}>Active</span>
            </div>
            
            {/* ponytail: Simplified pass details pane since we don't have the full real pass object here yet. Just enough to not crash. */}
            <p style={{ color: '#6B7280', fontSize: 14 }}>Real pass details would be fetched and displayed here based on {selectedPass}.</p>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default EventTimeline;
