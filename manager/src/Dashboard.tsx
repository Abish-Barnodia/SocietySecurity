import React, { useState, useEffect } from 'react';
import { API_BASE } from './config';
import Icon from './Icon';

const Dashboard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const getAuthToken = () => localStorage.getItem('accessToken') || '';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'all' | 'guard' | 'resident'>('all');

  // --- Real Backend Data States ---
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [guardPosts, setGuardPosts] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // --- Fetch Backend Data ---
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const headers = { 
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json'
      };

      // Execute all fetches in parallel
      const [statsRes, alertsRes, guardsRes, feedRes, walkinsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/reports/overview`, { headers }),
        fetch(`${API_BASE}/alerts`, { headers }),
        fetch(`${API_BASE}/guards/active`, { headers }),
        fetch(`${API_BASE}/entries/all`, { headers }),
        fetch(`${API_BASE}/walkins/pending`, { headers })
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const json = await statsRes.value.json();
        setStats(json.status === 'success' ? json.data : null);
      } else {
        setStats(null);
      }

      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const json = await alertsRes.value.json();
        setAlerts(json.status === 'success' && Array.isArray(json.data) ? json.data : []);
      } else {
        setAlerts([]);
      }

      if (guardsRes.status === 'fulfilled' && guardsRes.value.ok) {
        const json = await guardsRes.value.json();
        setGuardPosts(json.status === 'success' && Array.isArray(json.data) ? json.data : []);
      } else {
        setGuardPosts([]);
      }

      if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
        const json = await feedRes.value.json();
        setActivityFeed(json.status === 'success' && Array.isArray(json.data?.entries) ? json.data.entries : []);
      } else {
        setActivityFeed([]);
      }

      if (walkinsRes.status === 'fulfilled' && walkinsRes.value.ok) {
        const json = await walkinsRes.value.json();
        setPendingApprovals(json.status === 'success' && Array.isArray(json.data) ? json.data : []);
      } else {
        setPendingApprovals([]);
      }

    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh 30s
    return () => clearInterval(interval);
  }, []);

  // --- Derived Computed Data ---
  const unacknowledgedCount = alerts.filter(a => !a.acknowledgedAt).length;
  
  const displayStats = [
    { title: 'Active Guards', value: stats?.guardsOnDuty || '0', sub: 'Live from DB', icon: <Icon name="shield-check" size={24} />, type: 'positive' },
    { title: 'Residents On Premises', value: stats?.residentsOnPremises || '0', sub: 'Live from DB', icon: <Icon name="building-community" size={24} />, type: 'neutral' },
    { title: 'Visitors Today', value: stats?.activeVisitors || '0', sub: 'Live from DB', icon: <Icon name="users" size={24} />, type: 'positive' },
    { title: 'Pending Approvals', value: stats?.pendingWalkins || pendingApprovals.length.toString(), sub: pendingApprovals.length > 0 ? <><Icon name="arrow-down" size={11} /> {pendingApprovals.length} overdue</> : 'All cleared', icon: <Icon name="clock" size={24} />, type: pendingApprovals.length > 0 ? 'warning' : 'positive' },
    { title: 'Open Alerts', value: stats?.openIncidents || alerts.length.toString(), sub: unacknowledgedCount > 0 ? <><Icon name="arrow-down" size={11} /> {unacknowledgedCount} critical</> : 'All acknowledged', icon: <Icon name="alert-triangle" size={24} />, type: unacknowledgedCount > 0 ? 'negative' : 'positive' },
    { title: 'Gate Events Today', value: stats?.totalEntriesToday || '0', sub: 'Live from DB', icon: <Icon name="door-enter" size={24} />, type: 'positive' }, 
  ];

  // --- Actions ---
  const handleAcknowledge = async (id: string) => {
    try {
      await fetch(`${API_BASE}/alerts/${id}/acknowledge`, { method: 'POST', headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const filteredFeed = activityFeed.filter(item => {
    if (feedFilter === 'guard') return item.type === 'guard';
    if (feedFilter === 'resident') return item.type === 'resident';
    return true; 
  });

  // --- New Sections Computed Data ---
  const recentVisitors = activityFeed.filter(item => item.method === 'visitor' || item.visitorName || item.title?.toLowerCase().includes('visitor')).slice(0, 5);
  
  const guardStats = {
    total: guardPosts.length || stats?.guardsOnDuty || 0,
    onDuty: guardPosts.filter(g => g.status === 'On Post' || !g.status).length,
    onBreak: guardPosts.filter(g => g.status === 'Break').length,
    offDuty: guardPosts.filter(g => g.status === 'Unassigned' || g.status === 'Off').length,
  };

  const alertSummary = {
    security: alerts.filter(a => a.priority === 'P1' || a.type === 'SECURITY' || a.title?.toLowerCase().includes('security')).length,
    access: alerts.filter(a => a.type === 'ACCESS' || a.title?.toLowerCase().includes('access')).length,
    system: alerts.filter(a => a.priority === 'P3' || a.type === 'SYSTEM' || a.title?.toLowerCase().includes('system')).length,
    safety: alerts.filter(a => a.type === 'SAFETY' || a.title?.toLowerCase().includes('safety')).length,
  };

  const todayActivity = activityFeed.slice(0, 5);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Unified Operations Dashboard</h1>
          <p className="page-subtitle">Live overview of guard posts, resident activity, visitor movements, and alerts across Greenwood Towers</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', backgroundColor: '#F1F5F9', padding: '4px 8px', borderRadius: 4 }}>
            Auto-refresh: 30s
          </span>
          <button onClick={fetchData} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={isRefreshing}>
            <span style={{ display: 'flex', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }}><Icon name="refresh" size={14} /></span>
            {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* 6 Stat Tiles */}
      <div className="stats-grid">
        {displayStats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-title">{stat.title}</div>
            <div className={`stat-subtext ${stat.type}`}>{stat.sub}</div>
          </div>
        ))}
      </div>
      
      <div className="main-grid" style={{ gridTemplateColumns: '1.8fr 1.2fr' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Guard Post Status */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="map-pin" size={20} /> Guard Post Status</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#059669' }}>●</span> On Post</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#D97706' }}>●</span> Overdue</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#4B5563' }}>●</span> Break</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#94A3B8' }}>●</span> Off/Unassigned</span>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
              {guardPosts.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No active guards right now.</div>
              ) : (
                guardPosts.map(guard => (
                  <div key={guard.id} style={{ 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: 12,
                    backgroundColor: guard.status === 'Overdue' ? '#FFFBEB' : guard.status === 'Unassigned' ? '#F8FAFC' : 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{guard.entryPoint?.name || 'Unknown Post'}</div>
                      <div className={`status-badge status-on-post`}>{guard.status || 'On Post'}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{guard.entryPoint?.location || ''}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <div style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'flex', color: 'var(--text-muted)' }}><Icon name="user" size={13} /></span> {guard.name || guard.id}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="card" style={{ marginBottom: 0, padding: 0, display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '500px' }}>
             <div className="card-title" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', marginBottom: 0 }}>
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="news" size={20} /> Live Activity Feed</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 500 }}>
                <span onClick={() => setFeedFilter('all')} style={{ color: feedFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>All Events</span>
                <span onClick={() => setFeedFilter('guard')} style={{ color: feedFilter === 'guard' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>Guard Only</span>
                <span onClick={() => setFeedFilter('resident')} style={{ color: feedFilter === 'resident' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>Resident Only</span>
              </div>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredFeed.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No live activity to display.</div>
              ) : (
                filteredFeed.map(item => (
                  <div key={item.id} style={{ display: 'flex', gap: 16, padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                    <div className="feed-icon" style={{ 
                      background: item.severity === 'high' ? '#FEF3C7' : 'var(--primary-bg)',
                      color: item.severity === 'high' ? '#D97706' : 'var(--primary)'
                    }}>
                      {item.severity === 'high' ? <Icon name="alert-circle" size={16} /> : <Icon name="activity" size={16} />}
                    </div>
                    <div className="feed-content">
                      <div className="feed-title">
                        {item.title || item.method || 'System Event'}
                        {item.severity && <span className={`severity-badge ${item.severity.toLowerCase()}`}>{item.severity}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-main)', marginBottom: 8 }}>{item.body || item.notes || ''}</div>
                      <div className="feed-meta">
                        <span>{new Date(item.createdAt || item.entryAt).toLocaleTimeString()}</span>
                        {item.entryPoint && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="map-pin" size={11} /> {item.entryPoint.name}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Pending Approvals */}
          <div className="card" style={{ marginBottom: 0, padding: 0 }}>
            <div className="card-title" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--border-color)' }}>
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="clock-hour-4" size={20} /> Pending Approvals 
                {pendingApprovals.length > 0 && <span className="severity-badge" style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px' }}>{pendingApprovals.length} open</span>}
              </div>
            </div>
            <div className="approval-list" style={{ padding: '0 20px', maxHeight: '300px', overflowY: 'auto' }}>
              {pendingApprovals.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>All clear! No pending approvals.</div>
              ) : (
                pendingApprovals.map((app, index) => (
                  <div key={app.id} style={{ padding: '16px 0', borderBottom: index < pendingApprovals.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-main)' }}>{app.visitorName || 'Unknown'}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {/* Managers oversee, residents approve */}
                        <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>Awaiting Resident</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-main)', marginBottom: 8 }}>{app.purpose || app.notes}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="home" size={11} /> Unit {app.unit?.unitNumber || app.unitId}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="card" style={{ marginBottom: 0, padding: 0 }}>
            <div className="card-title" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--border-color)' }}>
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="alert-triangle" size={20} /> Active Alerts 
                {unacknowledgedCount > 0 && <span className="severity-badge" style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px' }}>{unacknowledgedCount} unacknowledged</span>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>All Alerts</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '400px', overflowY: 'auto' }}>
              {alerts.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No active alerts.</div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className={`alert-item ${(alert.priority || 'P3').toLowerCase()}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                        <span className={`severity-badge ${(alert.priority || 'P3').toLowerCase()}`}>{alert.priority || 'P3'}</span>
                        {alert.title}
                      </div>
                      {!alert.acknowledgedAt ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>Unacknowledged</span>
                          <button onClick={() => handleAcknowledge(alert.id)} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11 }}>Acknowledge</button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>⋮</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                      {alert.body}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* --- NEW SECTIONS EXTENSION --- */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Row 1: Recent Visitors + Today Activity */}
        <div className="main-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          
          {/* Recent Visitors */}
          <div className="card" style={{ marginBottom: 0, padding: 0 }}>
            <div className="card-title" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="users" size={20} /> Recent Visitors
              </div>
              <span style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>View All</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 500 }}>Visitor Name</th>
                    <th style={{ padding: '12px 20px', fontWeight: 500 }}>Unit/Host</th>
                    <th style={{ padding: '12px 20px', fontWeight: 500 }}>Purpose</th>
                    <th style={{ padding: '12px 20px', fontWeight: 500 }}>Entry Gate</th>
                    <th style={{ padding: '12px 20px', fontWeight: 500 }}>Time</th>
                    <th style={{ padding: '12px 20px', fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisitors.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No recent visitors.</td></tr>
                  ) : (
                    recentVisitors.map((visitor, i) => (
                      <tr key={visitor.id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                           <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'bold' }}>
                             {(visitor.visitorName || visitor.title || 'V')[0]}
                           </div>
                           <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{visitor.visitorName || visitor.title || 'Unknown Visitor'}</span>
                        </td>
                        <td style={{ padding: '12px 20px', color: 'var(--text-muted)' }}>{visitor.unit?.unitNumber || visitor.unitId || 'N/A'}</td>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: '#F3E8FF', color: '#7E22CE', fontSize: 11 }}>{visitor.purpose || visitor.notes || 'Visit'}</span>
                        </td>
                        <td style={{ padding: '12px 20px', color: 'var(--text-muted)' }}>{visitor.entryPoint?.name || 'Main Gate'}</td>
                        <td style={{ padding: '12px 20px', color: 'var(--text-muted)' }}>{new Date(visitor.createdAt || visitor.entryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ color: '#059669', fontWeight: 500 }}>Inside</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Today's Activity */}
          <div className="card" style={{ marginBottom: 0, padding: 0 }}>
             <div className="card-title" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="history" size={20} /> Today's Activity
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>View Timeline</span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
               {todayActivity.length === 0 ? (
                 <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No activities today.</div>
               ) : (
                 todayActivity.map((act, i) => (
                   <div key={act.id || i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                     {/* Timeline line */}
                     {i !== todayActivity.length - 1 && <div style={{ position: 'absolute', left: 11, top: 24, bottom: -16, width: 2, backgroundColor: 'var(--border-color)' }} />}
                     
                     <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: act.severity === 'high' ? '#FEE2E2' : 'var(--primary-bg)', color: act.severity === 'high' ? '#DC2626' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                       <Icon name={act.severity === 'high' ? 'alert-circle' : 'activity'} size={14} />
                     </div>
                     <div style={{ flex: 1, paddingBottom: i !== todayActivity.length - 1 ? 16 : 0 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                         <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-main)' }}>{act.title || act.method || 'System Event'}</span>
                         <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(act.createdAt || act.entryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                       <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                         {act.body || act.notes || ''} 
                         {act.entryPoint && <span style={{ marginLeft: 8, color: 'var(--text-main)' }}>• {act.entryPoint.name}</span>}
                       </div>
                     </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>

        {/* Row 2: Guard Status + Alert Summary + Quick Actions */}
        <div className="main-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          
          {/* Guard Status */}
          <div className="card" style={{ marginBottom: 0 }}>
             <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="shield" size={20} /> Guard Status
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>View All</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 16 }}>
              {/* Fake Circular Chart using CSS conic-gradient */}
              <div style={{ 
                width: 120, height: 120, borderRadius: '50%', 
                background: `conic-gradient(#10B981 ${guardStats.onDuty / (guardStats.total || 1) * 360}deg, #F59E0B 0 ${(guardStats.onDuty + guardStats.onBreak) / (guardStats.total || 1) * 360}deg, #6B7280 0 360deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ width: 90, height: 90, borderRadius: '50%', backgroundColor: 'var(--bg-body)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                   <span style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--text-main)' }}>{guardStats.total}</span>
                   <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Guards</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}><span style={{ color: '#10B981' }}>●</span> On Duty</span>
                  <span style={{ color: 'var(--text-muted)' }}>{guardStats.onDuty} ({guardStats.total ? Math.round(guardStats.onDuty/guardStats.total*100) : 0}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}><span style={{ color: '#F59E0B' }}>●</span> On Break</span>
                  <span style={{ color: 'var(--text-muted)' }}>{guardStats.onBreak} ({guardStats.total ? Math.round(guardStats.onBreak/guardStats.total*100) : 0}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}><span style={{ color: '#6B7280' }}>●</span> Off Duty</span>
                  <span style={{ color: 'var(--text-muted)' }}>{guardStats.offDuty} ({guardStats.total ? Math.round(guardStats.offDuty/guardStats.total*100) : 0}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alert Summary */}
          <div className="card" style={{ marginBottom: 0 }}>
             <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="bell" size={20} /> Alert Summary
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>View All</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}><Icon name="alert-triangle" size={16} color="var(--danger)" /> Security Alerts</span>
                <span style={{ fontWeight: 600 }}>{alertSummary.security}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}><Icon name="lock" size={16} color="var(--warning)" /> Access Violations</span>
                <span style={{ fontWeight: 600 }}>{alertSummary.access}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}><Icon name="settings" size={16} color="var(--info)" /> System Alerts</span>
                <span style={{ fontWeight: 600 }}>{alertSummary.system}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}><Icon name="shield-check" size={16} color="var(--success)" /> Safety Alerts</span>
                <span style={{ fontWeight: 600 }}>{alertSummary.safety}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ marginBottom: 0 }}>
             <div className="card-title">
              <div className="card-title-icon" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="bolt" size={20} /> Quick Actions
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <div onClick={() => onNavigate?.('expected')} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="user-plus" size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Add New Visitor</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Register a new visitor</div>
                  </div>
                  <Icon name="chevron-right" size={16} color="var(--text-muted)" />
                </div>
              </div>
              <div onClick={() => onNavigate?.('alerts')} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="file-plus" size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Create Alert</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Raise a security alert</div>
                  </div>
                  <Icon name="chevron-right" size={16} color="var(--text-muted)" />
                </div>
              </div>
              <div onClick={() => onNavigate?.('reports')} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: '#F3E8FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="report" size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Generate Report</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Create security report</div>
                  </div>
                  <Icon name="chevron-right" size={16} color="var(--text-muted)" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Dashboard;
