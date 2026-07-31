import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api/v1';

const Dashboard: React.FC = () => {
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
    { title: 'Active Guards', value: stats?.guardsOnDuty || '0', sub: 'Live from DB', icon: '🛡️', type: 'positive' },
    { title: 'Residents On Premises', value: stats?.residentsOnPremises || '0', sub: 'Live from DB', icon: '🏢', type: 'neutral' },
    { title: 'Visitors Today', value: stats?.activeVisitors || '0', sub: 'Live from DB', icon: '👥', type: 'positive' },
    { title: 'Pending Approvals', value: stats?.pendingWalkins || pendingApprovals.length.toString(), sub: pendingApprovals.length > 0 ? `↓ ${pendingApprovals.length} overdue` : 'All cleared', icon: '⏱️', type: pendingApprovals.length > 0 ? 'warning' : 'positive' },
    { title: 'Open Alerts', value: stats?.openIncidents || alerts.length.toString(), sub: unacknowledgedCount > 0 ? `↓ ${unacknowledgedCount} critical` : 'All acknowledged', icon: '⚠️', type: unacknowledgedCount > 0 ? 'negative' : 'positive' },
    { title: 'Gate Events Today', value: stats?.totalEntriesToday || '0', sub: 'Live from DB', icon: '🚪', type: 'positive' }, 
  ];

  // --- Actions ---
  const handleApprove = async (id: string) => {
    try {
      await fetch(`${API_BASE}/walkins/${id}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
      fetchData(); // Refresh data
    } catch (err) { console.error(err); }
  };

  const handleDeny = async (id: string) => {
    try {
      await fetch(`${API_BASE}/walkins/${id}/deny`, { method: 'POST', headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
      fetchData();
    } catch (err) { console.error(err); }
  };

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
            <span style={{ transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }}>↻</span> 
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
              <div className="card-title-icon">📍 Guard Post Status</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#059669' }}>●</span> On Post</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#D97706' }}>●</span> Overdue</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#4B5563' }}>●</span> Break</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#94A3B8' }}>●</span> Off/Unassigned</span>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
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
                        <span style={{ color: 'var(--text-muted)' }}>👤</span> {guard.name || guard.id}
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
              <div className="card-title-icon">📰 Live Activity Feed</div>
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
                      {item.severity === 'high' ? '⚠️' : '≡'}
                    </div>
                    <div className="feed-content">
                      <div className="feed-title">
                        {item.title || item.method || 'System Event'}
                        {item.severity && <span className={`severity-badge ${item.severity.toLowerCase()}`}>{item.severity}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-main)', marginBottom: 8 }}>{item.body || item.notes || ''}</div>
                      <div className="feed-meta">
                        <span>{new Date(item.createdAt || item.entryAt).toLocaleTimeString()}</span>
                        {item.entryPoint && <span>📍 {item.entryPoint.name}</span>}
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
              <div className="card-title-icon">
                ⏱️ Pending Approvals 
                {pendingApprovals.length > 0 && <span className="severity-badge" style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px' }}>{pendingApprovals.length} open</span>}
              </div>
            </div>
            <div className="approval-list" style={{ padding: '0 20px' }}>
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
                      <div>🏠 Unit {app.unit?.unitNumber || app.unitId}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="card" style={{ marginBottom: 0, padding: 0 }}>
            <div className="card-title" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--border-color)' }}>
              <div className="card-title-icon">
                ⚠️ Active Alerts 
                {unacknowledgedCount > 0 && <span className="severity-badge" style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px' }}>{unacknowledgedCount} unacknowledged</span>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>All Alerts</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
    </div>
  );
};

export default Dashboard;
