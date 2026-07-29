import React, { useState, useEffect } from 'react';
import { Building, ShieldCheck, CheckCircle, AlertTriangle, Key, ArrowRight, User, X, MapPin, Search } from 'lucide-react';

const EventTimeline = () => {
  const [viewType, setViewType] = useState<'unit' | 'guard'>('unit');
  const [selectedUnit, setSelectedUnit] = useState('A-401');
  const [selectedGuard, setSelectedGuard] = useState('SEC-1042');
  const [selectedPass, setSelectedPass] = useState<string | null>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const url = viewType === 'unit' 
        ? `http://localhost:3000/api/v1/timeline?unitId=${selectedUnit}`
        : `http://localhost:3000/api/v1/timeline?guardId=${selectedGuard}`;
        
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
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
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {viewType === 'unit' ? (
            <>
              <button 
                onClick={() => setSelectedUnit('A-401')}
                style={{ 
                  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  backgroundColor: selectedUnit === 'A-401' ? '#008B8B' : '#F3F4F6',
                  color: selectedUnit === 'A-401' ? 'white' : '#4B5563'
                }}
              >
                Unit A-401 — Ananya & Karthik Iyer
              </button>
              <button 
                onClick={() => setSelectedUnit('B-701')}
                style={{ 
                  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  backgroundColor: selectedUnit === 'B-701' ? '#008B8B' : '#F3F4F6',
                  color: selectedUnit === 'B-701' ? 'white' : '#4B5563'
                }}
              >
                Unit B-701 — Vikram & Neha Desai
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setSelectedGuard('SEC-1042')}
                style={{ 
                  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  backgroundColor: selectedGuard === 'SEC-1042' ? '#008B8B' : '#F3F4F6',
                  color: selectedGuard === 'SEC-1042' ? 'white' : '#4B5563'
                }}
              >
                Rajesh Kumar (SEC-1042)
              </button>
              <button 
                onClick={() => setSelectedGuard('SEC-1071')}
                style={{ 
                  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  backgroundColor: selectedGuard === 'SEC-1071' ? '#008B8B' : '#F3F4F6',
                  color: selectedGuard === 'SEC-1071' ? 'white' : '#4B5563'
                }}
              >
                Amit Sharma (SEC-1071)
              </button>
            </>
          )}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 24, borderBottom: '1px solid #E5E7EB', paddingBottom: 12 }}>
          {viewType === 'unit' ? 'Timeline for Unit A-401' : 'Timeline for Rajesh Kumar'} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>— {viewType === 'unit' ? 'Ananya & Karthik Iyer' : 'SEC-1042'}</span>
        </h3>

        {/* Timeline Events */}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, backgroundColor: '#E5E7EB' }}></div>
          {events.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: 14, marginTop: 24 }}>No events found.</p>
          ) : events.map((evt, idx) => (
            <div key={evt.id} style={{ display: 'flex', gap: 24, marginBottom: 32, position: 'relative' }}>
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
              <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 500, backgroundColor: '#F3F4F6', color: '#4B5563' }}>Permanent</span>
            </div>

            <h4 style={{ margin: '0 0 16px 0', fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Visitor</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              <img src="https://i.pravatar.cc/150?img=47" alt="Avatar" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <h5 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 600, color: '#111827' }}>Lakshmi Amma</h5>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>+91 98765 43210</p>
              </div>
            </div>

            <h4 style={{ margin: '0 0 16px 0', fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Resident</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #F3F4F6', marginBottom: 12 }}>
              <span style={{ color: '#6B7280', fontSize: 14 }}>Unit</span>
              <span style={{ color: '#111827', fontSize: 14, fontWeight: 500 }}>A-401</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #F3F4F6', marginBottom: 12 }}>
              <span style={{ color: '#6B7280', fontSize: 14 }}>Resident</span>
              <span style={{ color: '#111827', fontSize: 14, fontWeight: 500 }}>Ananya & Karthik Iyer</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
              <span style={{ color: '#6B7280', fontSize: 14 }}>Issued By</span>
              <span style={{ color: '#111827', fontSize: 14, fontWeight: 500 }}>Ananya Iyer</span>
            </div>

            <h4 style={{ margin: '0 0 16px 0', fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Validity</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <span style={{ color: '#6B7280', fontSize: 12 }}>Created</span>
                <div style={{ color: '#111827', fontSize: 14, fontWeight: 500, marginTop: 4 }}>15 Mar 2023</div>
              </div>
              <div>
                <span style={{ color: '#6B7280', fontSize: 12 }}>Expires</span>
                <div style={{ color: '#111827', fontSize: 14, fontWeight: 500, marginTop: 4 }}>14 Mar 2027</div>
              </div>
              <div>
                <span style={{ color: '#6B7280', fontSize: 12 }}>Daily From</span>
                <div style={{ color: '#111827', fontSize: 14, fontWeight: 500, marginTop: 4 }}>06:00 AM</div>
              </div>
              <div>
                <span style={{ color: '#6B7280', fontSize: 12 }}>Daily Until</span>
                <div style={{ color: '#111827', fontSize: 14, fontWeight: 500, marginTop: 4 }}>08:00 PM</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #F3F4F6', marginBottom: 24 }}>
              <span style={{ color: '#6B7280', fontSize: 14 }}>Entry Point</span>
              <span style={{ color: '#111827', fontSize: 14, fontWeight: 500 }}>Main Gate A</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 32 }}>
              <div style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>412</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Total Uses</div>
              </div>
              <div style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>24 Jul 2026<br/>09:15 AM</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Last Used</div>
              </div>
              <div style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>0</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Stale Days</div>
              </div>
            </div>

            <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</h4>
            <p style={{ margin: '0 0 32px 0', fontSize: 14, color: '#4B5563', lineHeight: 1.5 }}>
              House help — comes daily except Sundays. Has been with the family for 8 years.
            </p>

            <h4 style={{ margin: '0 0 16px 0', fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recent Activity</h4>
            <div style={{ position: 'relative', paddingLeft: 16, marginBottom: 32 }}>
              <div style={{ position: 'absolute', left: 4, top: 8, bottom: 8, width: 1, backgroundColor: '#E5E7EB' }}></div>
              {[
                { type: 'Entry', gate: 'Main Gate A', guard: 'Rajesh Kumar', time: '24 Jul 2026 - 09:15 AM' },
                { type: 'Exit', gate: 'Main Gate A', guard: 'Manoj Tiwari', time: '23 Jul 2026 - 07:30 PM' },
                { type: 'Entry', gate: 'Main Gate A', guard: 'Rajesh Kumar', time: '23 Jul 2026 - 09:00 AM' },
                { type: 'Exit', gate: 'Main Gate A', guard: 'Manoj Tiwari', time: '22 Jul 2026 - 06:45 PM' },
                { type: 'Entry', gate: 'Main Gate A', guard: 'Rajesh Kumar', time: '22 Jul 2026 - 09:10 AM' }
              ].map((act, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -14, top: 4, width: 5, height: 5, borderRadius: '50%', backgroundColor: '#008B8B' }}></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{act.type} - {act.gate}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{act.guard}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{act.time}</div>
                </div>
              ))}
            </div>

            <h4 style={{ margin: '0 0 16px 0', fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>QR Code</h4>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 24, borderRadius: 8 }}>
              <div style={{ width: 100, height: 100, backgroundColor: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7EB', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>[QR Image]</span>
              </div>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{selectedPass}-QR</span>
            </div>
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
