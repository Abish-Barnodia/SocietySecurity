import { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const AlertsEscalation = () => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';
  
  const [alerts, setAlerts] = useState<any[]>([]);
  const [chains, setChains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'P1' | 'P2' | 'P3'>('ALL');
  // ponytail: defaulting to today's date for quick real-time view
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);


  // Broadcast Modal State
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', severity: 'HIGH' });

  const fetchAllData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${getAuthToken()}` };
      
      // Fetch incidents, alerts (which includes vehicle & duress), pending walkins, and chains
      const [incRes, alertRes, walkinRes, chainsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/incidents`, { headers }),
        fetch(`${API_BASE}/alerts`, { headers }),
        fetch(`${API_BASE}/walkin/pending`, { headers }),
        fetch(`${API_BASE}/escalation/chains`, { headers })
      ]);

      const unifiedAlerts: any[] = [];

      // 1. Process Incidents
      if (incRes.status === 'fulfilled' && incRes.value.ok) {
        const data = await incRes.value.json();
        (data.data || []).forEach((inc: any) => {
          unifiedAlerts.push({
            id: `inc-${inc.id}`,
            realId: inc.id,
            sourceType: 'INCIDENT',
            title: `Incident: ${inc.type?.replace(/_/g, ' ')}`,
            description: inc.location,
            status: inc.status,
            createdAt: inc.createdAt,
            priority: getPriorityInfo(inc.type).level,
            actor: inc.guard?.user?.name || 'Guard App'
          });
        });
      }

      // 2. Process General Alerts (Duress, Vehicles, Custom)
      if (alertRes.status === 'fulfilled' && alertRes.value.ok) {
        const data = await alertRes.value.json();
        (data.data || []).forEach((al: any) => {
          unifiedAlerts.push({
            id: `al-${al.id}`,
            realId: al.id,
            sourceType: 'ALERT',
            title: al.title,
            description: al.body,
            status: al.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'OPEN',
            createdAt: al.createdAt,
            priority: al.priority,
            actor: 'System Monitoring'
          });
        });
      }

      // 3. Process Pending Walk-ins
      if (walkinRes.status === 'fulfilled' && walkinRes.value.ok) {
        const data = await walkinRes.value.json();
        (data.data || []).forEach((w: any) => {
          unifiedAlerts.push({
            id: `walkin-${w.id}`,
            realId: w.id,
            sourceType: 'WALKIN',
            title: `Pending Walk-in — ${w.visitorName}`,
            description: `Unit ${w.unit?.unitNumber} at ${w.entryPoint?.name}`,
            status: 'IN_PROGRESS',
            createdAt: w.createdAt,
            priority: 'P3',
            actor: 'Gate App'
          });
        });
      }

      // Sort all combined alerts by date descending
      unifiedAlerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setAlerts(unifiedAlerts);

      // 4. Process Chains
      if (chainsRes.status === 'fulfilled' && chainsRes.value.ok) {
        const data = await chainsRes.value.json();
        setChains(data.data || []);
      }

    } catch (error) {
      console.error('Failed to fetch alerts data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (alert: any) => {
    try {
      const headers = { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' };
      let res;
      
      if (alert.sourceType === 'INCIDENT') {
        res = await fetch(`${API_BASE}/incidents/${alert.realId}/close`, {
          method: 'POST', headers, body: JSON.stringify({ resolutionNote: 'Resolved from dashboard' })
        });
      } else if (alert.sourceType === 'ALERT') {
        res = await fetch(`${API_BASE}/alerts/${alert.realId}/acknowledge`, {
          method: 'PUT', headers
        });
      } else {
        // Just refresh for walkins (can't directly resolve from here easily without resident context)
        fetchAllData();
        return;
      }

      if (res && res.ok) {
        fetchAllData();
      } else {
        alert('Failed to resolve alert');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBroadcast = async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts/broadcast`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'GENERAL_NOTICE',
          severity: broadcastForm.severity,
          title: broadcastForm.title,
          message: broadcastForm.message,
          targetRoles: ['RESIDENT', 'GUARD']
        })
      });
      if (res.ok) {
        setIsBroadcastOpen(false);
        setBroadcastForm({ title: '', message: '', severity: 'HIGH' });
        fetchAllData();
      } else {
        alert('Failed to broadcast alert');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityInfo = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t.includes('EMERGENCY') || t.includes('FIRE') || t.includes('FORCED')) return { level: 'P1', bg: '#FEF2F2', text: '#DC2626', badgeBg: '#FEE2E2' };
    if (t.includes('ROUTINE') || t.includes('NOISE')) return { level: 'P3', bg: '#F0FDF4', text: '#16A34A', badgeBg: '#DCFCE7' };
    return { level: 'P2', bg: '#F8FAFC', text: '#475569', badgeBg: '#E2E8F0' };
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'OPEN': return { bg: '#FEF3C7', text: '#D97706' };
      case 'IN_PROGRESS': return { bg: '#E0F2FE', text: '#0284C7' };
      case 'ACKNOWLEDGED': return { bg: '#F3E8FF', text: '#7E22CE' };
      case 'CLOSED': return { bg: '#D1FAE5', text: '#059669' };
      default: return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  const getPriorityConfig = (priorityLevel: string) => {
    switch(priorityLevel) {
      case 'P1': return { level: 'P1', text: '#DC2626', badgeBg: '#FEE2E2' };
      case 'P3': return { level: 'P3', text: '#16A34A', badgeBg: '#DCFCE7' };
      case 'P2':
      default: return { level: 'P2', text: '#475569', badgeBg: '#E2E8F0' };
    }
  };

  const filteredAlerts = alerts.filter(a => {
    const alertDate = new Date(a.createdAt).toISOString().split('T')[0];
    return (statusFilter === 'ALL' || a.status === statusFilter) &&
           (priorityFilter === 'ALL' || a.priority === priorityFilter) &&
           (!dateFilter || alertDate === dateFilter);
  });
  const criticalActiveCount = alerts.filter(a => a.priority === 'P1' && a.status === 'OPEN').length;

  return (
    <div style={{ padding: '24px 32px', flex: 1, overflowY: 'auto', backgroundColor: '#fff', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>Alerts & Escalation</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Unified alert queue with escalation chain management — duress, incidents, vehicles, walk-ins</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280' }}>
            <span style={{ fontWeight: 600 }}>{criticalActiveCount} critical active</span>
          </div>
          <button 
            onClick={() => setIsBroadcastOpen(true)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', 
              borderRadius: 6, backgroundColor: '#D97706', color: 'white', border: 'none', 
              fontWeight: 600, fontSize: 14, cursor: 'pointer' 
            }}
          >
            <Icon name="speakerphone" size={16} /> Broadcast Alert
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32 }}>
        
        {/* Left Column - Alert Queue */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'ALL' | 'OPEN')}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontSize: 14 }}
            >
              <option value="ALL">All Alerts</option>
              <option value="OPEN">Open Alerts</option>
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as 'ALL' | 'P1' | 'P2' | 'P3')}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontSize: 14 }}
            >
              <option value="ALL">All Priorities</option>
              <option value="P1">Priority 1 (Critical)</option>
              <option value="P2">Priority 2 (Urgent)</option>
              <option value="P3">Priority 3 (Routine)</option>
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #E5E7EB', backgroundColor: 'white', color: '#374151', fontSize: 14 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 8 }}>
            {filteredAlerts.length === 0 && !loading && (
              <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', border: '1px dashed #E5E7EB', borderRadius: 8 }}>
                No alerts currently active.
              </div>
            )}
            {filteredAlerts.map(alert => {
              const priority = getPriorityConfig(alert.priority);
              const statusColors = getStatusColor(alert.status);
              const isClosed = alert.status === 'CLOSED' || alert.status === 'ACKNOWLEDGED';

              return (
                <div key={alert.id} style={{ 
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px', 
                  borderRadius: 8, border: `1px solid ${priority.level === 'P1' && !isClosed ? '#FCA5A5' : '#E5E7EB'}`,
                  backgroundColor: 'white'
                }}>
                  <div style={{ 
                    width: 32, height: 32, borderRadius: '50%', backgroundColor: priority.badgeBg, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: priority.text, fontWeight: 700, fontSize: 13, flexShrink: 0
                  }}>
                    {priority.level}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                        {alert.title}
                      </h3>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                        backgroundColor: statusColors.bg, color: statusColors.text
                      }}>
                        {alert.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{new Date(alert.createdAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span>•</span>
                      <span>{alert.actor}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
                      {alert.description}
                    </div>
                  </div>

                  {!isClosed && alert.sourceType !== 'WALKIN' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        onClick={() => handleResolve(alert)}
                        style={{ 
                          padding: '6px 16px', borderRadius: 6, backgroundColor: '#008B8B', color: 'white', 
                          border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer' 
                        }}
                      >
                        Acknowledge
                      </button>
                    </div>
                  ) : isClosed ? (
                    <div style={{ color: '#9CA3AF' }}>
                      <Icon name="circle-check" size={20} />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column - Escalation Chains */}
        <div style={{ width: 400, flexShrink: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#111827' }}>Escalation Chains</h3>
          
          {chains.length === 0 && !loading && (
             <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', border: '1px dashed #E5E7EB', borderRadius: 8 }}>
               No escalation chains configured.
             </div>
          )}

          {chains.map((chain) => (
            <div key={chain.id} style={{ marginBottom: 24, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontWeight: 600, fontSize: 14 }}>
                Priority {chain.priority} — {chain.priority === 'P1' ? 'Critical' : chain.priority === 'P2' ? 'Urgent' : 'Routine'}
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {chain.steps.map((step: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#6B7280' }}>
                        {step.order}
                      </span>
                      {step.roleLabel} <span style={{ color: '#9CA3AF' }}>— {step.name}</span>
                    </span>
                    <span style={{ color: '#6B7280' }}>
                      {step.delayMinutes === 0 ? 'Immediate' : `+${step.delayMinutes}m`} 
                      <span style={{ fontSize: 11, backgroundColor: '#E5E7EB', padding: '2px 4px', borderRadius: 4, marginLeft: 4 }}>{step.channel}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* Broadcast Alert Modal */}
      {isBroadcastOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, width: 450, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Broadcast Alert</h2>
              <button onClick={() => setIsBroadcastOpen(false)} className="modal-close"><Icon name="x" size={18}/></button>
            </div>
            
            <p style={{ margin: '0 0 20px 0', fontSize: 14, color: '#4B5563' }}>Send a real-time push notification to both Residents and Guards.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>Alert Title</label>
                <input 
                  type="text" 
                  value={broadcastForm.title}
                  onChange={e => setBroadcastForm({...broadcastForm, title: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 14 }}
                  placeholder="e.g. Stray Dog Near Block A"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>Message</label>
                <textarea 
                  value={broadcastForm.message}
                  onChange={e => setBroadcastForm({...broadcastForm, message: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 14, minHeight: 80, resize: 'none' }}
                  placeholder="Details of the alert..."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>Severity</label>
                <select 
                  value={broadcastForm.severity}
                  onChange={e => setBroadcastForm({...broadcastForm, severity: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 14, backgroundColor: 'white' }}
                >
                  <option value="CRITICAL">Critical (P1)</option>
                  <option value="HIGH">High (P2)</option>
                  <option value="LOW">Routine (P3)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button 
                  onClick={() => setIsBroadcastOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 6, backgroundColor: 'white', border: '1px solid #E5E7EB', color: '#4B5563', fontWeight: 500, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBroadcast}
                  style={{ flex: 1, padding: '10px', borderRadius: 6, backgroundColor: '#D97706', border: 'none', color: 'white', fontWeight: 500, cursor: 'pointer' }}
                >
                  Send to Everyone
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AlertsEscalation;
