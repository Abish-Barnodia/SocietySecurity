import React, { useState, useEffect } from 'react';
import './index.css';
import Dashboard from './Dashboard';
import GuardManagement from './GuardManagement';
import ResidentDirectory from './ResidentDirectory';
import EventTimeline from './EventTimeline';
import AlertsEscalation from './AlertsEscalation';
import ExpectedVisitors from './ExpectedVisitors';
import CommunityControl from './CommunityControl';
import ReportsCompliance from './ReportsCompliance';
import WorkforceMgmt from './WorkforceMgmt';
import ParkingVehicles from './ParkingVehicles';
import EventsManagement from './EventsManagement';
import MaintenanceManagement from './MaintenanceManagement';
import FundManagement from './FundManagement';
import Login from './Login';
import ManagerProfile from './ManagerProfile';
import Settings, { applyManagerTheme } from './Settings';
import CCTVMonitoring from './CCTVMonitoring';
import Icon from './Icon';

import { API_BASE } from './config';

// Applied synchronously at module load (before first paint) from the locally
// cached theme choice, so there's no flash of the wrong theme on refresh.
// Settings.tsx reconciles this against the DB value once it loads.
const cachedTheme = localStorage.getItem('managerTheme');
if (cachedTheme) applyManagerTheme(cachedTheme);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) return;

    setIsAuthenticated(true);

    // Fetch full profile for property details, and confirm the stored token
    // is actually still valid — a stale/expired/session-ended token (e.g.
    // a manager whose Manager Portal session ended) must bounce back to
    // Login instead of leaving the app stuck with no data ever loading.
    fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          setFullProfile(data.data);
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
        }
      })
      .catch(console.error);
  }, [isAuthenticated]);

  const handleLogin = (_token: string, _loggedInUser: any) => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    // Must actually hit the backend — for a manager this is what releases
    // the single-active-session lock immediately instead of leaving the
    // portal blocked for everyone else until the idle timeout.
    const token = localStorage.getItem('accessToken');
    const storedRefreshToken = localStorage.getItem('refreshToken');
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });
    } catch {
      // Log out locally regardless of network/API failure.
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const operationsNav = [
    { id: 'dashboard', label: 'Dashboard', icon: <Icon name="layout-dashboard" size={18} /> },
    { id: 'guards', label: 'Guard Management', icon: <Icon name="shield-check" size={18} /> },
    { id: 'residents', label: 'Resident Directory', icon: <Icon name="users" size={18} /> },
    { id: 'timeline', label: 'Event Timeline', icon: <Icon name="clock" size={18} /> },
    { id: 'alerts', label: 'Alerts & Escalation', icon: <Icon name="alert-triangle" size={18} />, badge: '4' },
    { id: 'expected', label: 'Expected Visitors', icon: <Icon name="user-check" size={18} /> },
    { id: 'parking', label: 'Parking & Vehicles', icon: <Icon name="car" size={18} /> },
    { id: 'cctv', label: 'CCTV Monitoring', icon: <Icon name="video" size={18} /> }
  ];

  const adminNav = [
    { id: 'reports', label: 'Reports', icon: <Icon name="file-text" size={18} /> },
    { id: 'community', label: 'Community Control', icon: <Icon name="users-group" size={18} /> },
    { id: 'workforce', label: 'Workforce Mgmt', icon: <Icon name="calendar-week" size={18} /> },
    { id: 'events', label: 'Events', icon: <Icon name="calendar-event" size={18} /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Icon name="receipt" size={18} /> },
    { id: 'funds', label: 'Fund Management', icon: <Icon name="wallet" size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Icon name="settings" size={18} /> }
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar" style={{ width: isSidebarCollapsed ? 72 : 260, transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* Logo / Brand */}
        <div className="sidebar-header" style={{ marginBottom: 0, justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}>
          {!isSidebarCollapsed && (
            <div style={{
              background: 'linear-gradient(135deg, #00C896 0%, #00A67C 100%)',
              padding: '7px', borderRadius: '9px', color: 'white', display: 'flex',
              boxShadow: '0 2px 8px rgba(0,200,150,0.35)', flexShrink: 0
            }}>
              <Icon name="shield-check" size={20} />
            </div>
          )}
          {!isSidebarCollapsed && (
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.5px', color: 'white' }}>SecureGate</span>
          )}
          <div
            style={{
              marginLeft: isSidebarCollapsed ? 0 : 'auto',
              color: '#94A3B8', cursor: 'pointer', padding: 6, borderRadius: 6,
              transition: 'color 0.15s, background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onMouseEnter={e => { e.currentTarget.style.color = '#00C896'; e.currentTarget.style.background = 'rgba(0,200,150,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon name="menu-2" size={20} />
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {!isSidebarCollapsed && <div className="sidebar-section">Operations</div>}
          {isSidebarCollapsed && <div style={{ height: 16 }} />}
          <nav className="sidebar-nav">
            {operationsNav.map(item => (
              <a
                key={item.id}
                href="#"
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={(e) => { e.preventDefault(); setActiveTab(item.id); }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
                {!isSidebarCollapsed && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                {!isSidebarCollapsed && item.badge && (
                  <span style={{
                    marginLeft: 'auto', background: '#F59E0B', color: 'white',
                    borderRadius: '50%', width: 18, height: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0
                  }}>
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>

          {!isSidebarCollapsed && <div className="sidebar-section" style={{ marginTop: 4 }}>Administration</div>}
          {isSidebarCollapsed && <div style={{ height: 12 }} />}
          <nav className="sidebar-nav">
            {adminNav.map(item => (
              <a
                key={item.id}
                href="#"
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={(e) => { e.preventDefault(); setActiveTab(item.id); }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
                {!isSidebarCollapsed && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
              </a>
            ))}
          </nav>
        </div>

        {/* User Footer */}
        <div
          style={{
            padding: isSidebarCollapsed ? '14px 0' : '14px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center',
            gap: 10,
            background: 'rgba(0,0,0,0.2)',
            justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
            cursor: 'pointer',
          }}
          onClick={() => !isSidebarCollapsed && setActiveTab('profile')}
        >
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #00C896 0%, #00A67C 100%)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, letterSpacing: '0.5px',
            boxShadow: '0 0 0 2px rgba(0,200,150,0.3)',
          }}>
            {(fullProfile?.manager?.name?.substring(0, 2) || 'AM').toUpperCase()}
          </div>
          {!isSidebarCollapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullProfile?.manager?.name || 'Loading...'}
                </div>
                <div style={{ fontSize: 11, color: '#3D5450', marginTop: 1 }}>
                  {fullProfile?.role === 'MANAGER' ? 'Facility Manager' : 'Admin'}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                title="Logout"
                style={{
                  flexShrink: 0, color: '#3D5450', background: 'transparent',
                  border: 'none', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', padding: 6, borderRadius: 6, transition: 'color 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#3D5450')}
              >
                <Icon name="logout" size={16} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--primary)' }}>●</span> Live
            <span style={{ margin: '0 8px', color: 'var(--border-color)' }}>•</span>
            <span style={{ color: 'var(--text-muted)' }}>Last refresh: 30s ago</span>
          </div>
          <div className="topbar-right">
            <input type="text" className="search-bar" placeholder="Search units, guards, passes..." />
            
            <div className="topbar-icon" onClick={() => setActiveTab('alerts')} style={{ cursor: 'pointer' }}>
              <Icon name="bell" size={18} />
              <span style={{ 
                position: 'absolute', top: 6, right: 6, 
                background: 'var(--warning)', borderRadius: '50%', 
                width: 6, height: 6 
              }}></span>
            </div>
            
            <div className="topbar-icon" onClick={() => setActiveTab('profile')} style={{ background: 'var(--primary-bg)', color: 'var(--primary)', cursor: 'pointer' }}>
              <Icon name="user" size={18} />
            </div>

            <div className="property-selector">
              <Icon name="building" size={16} color="var(--text-muted)" />
              {fullProfile?.manager?.property?.name || 'Loading...'}
              <Icon name="chevron-down" size={16} color="var(--text-muted)" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'guards' && <GuardManagement />}
          {activeTab === 'residents' && <ResidentDirectory />}
          {activeTab === 'timeline' && <EventTimeline />}
          {activeTab === 'alerts' && <AlertsEscalation />}
          {activeTab === 'expected' && <ExpectedVisitors />}
          {activeTab === 'parking' && <ParkingVehicles />}
          {activeTab === 'community' && <CommunityControl />}
          {activeTab === 'reports' && <ReportsCompliance />}
          {activeTab === 'workforce' && <WorkforceMgmt />}
          {activeTab === 'events' && <EventsManagement />}
          {activeTab === 'maintenance' && <MaintenanceManagement />}
          {activeTab === 'funds' && <FundManagement />}
          {activeTab === 'profile' && <ManagerProfile />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'cctv' && <CCTVMonitoring />}
          {activeTab !== 'dashboard' && activeTab !== 'guards' && activeTab !== 'residents' && activeTab !== 'timeline' && activeTab !== 'alerts' && activeTab !== 'expected' && activeTab !== 'parking' && activeTab !== 'community' && activeTab !== 'reports' && activeTab !== 'workforce' && activeTab !== 'events' && activeTab !== 'maintenance' && activeTab !== 'funds' && activeTab !== 'profile' && activeTab !== 'settings' && activeTab !== 'cctv' && (
            <div className="card">
              <h2>{operationsNav.concat(adminNav).find(i => i.id === activeTab)?.label}</h2>
              <p>This module is under construction.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
