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
import Login from './Login';
import ManagerProfile from './ManagerProfile';
import { 
  LayoutDashboard, ShieldCheck, Users, Clock, AlertTriangle, 
  UserCheck, Car, Video, FileText, UsersRound, CalendarDays, 
  Settings, Search, Bell, User, Menu, ChevronDown, Building, LogOut 
} from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // ponytail: Simple auth check on load
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
      
      // Fetch full profile for property details
      fetch('http://localhost:5000/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setFullProfile(data.data);
          }
        })
        .catch(console.error);
    }
  }, [isAuthenticated]);

  const handleLogin = (token: string, loggedInUser: any) => {
    setIsAuthenticated(true);
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const operationsNav = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'guards', label: 'Guard Management', icon: <ShieldCheck size={18} /> },
    { id: 'residents', label: 'Resident Directory', icon: <Users size={18} /> },
    { id: 'timeline', label: 'Event Timeline', icon: <Clock size={18} /> },
    { id: 'alerts', label: 'Alerts & Escalation', icon: <AlertTriangle size={18} />, badge: '4' },
    { id: 'expected', label: 'Expected Visitors', icon: <UserCheck size={18} /> },
    { id: 'parking', label: 'Parking & Vehicles', icon: <Car size={18} /> },
    { id: 'cctv', label: 'CCTV Monitoring', icon: <Video size={18} /> }
  ];

  const adminNav = [
    { id: 'reports', label: 'Reports', icon: <FileText size={18} /> },
    { id: 'community', label: 'Community Control', icon: <UsersRound size={18} /> },
    { id: 'workforce', label: 'Workforce Mgmt', icon: <CalendarDays size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> }
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar" style={{ width: isSidebarCollapsed ? 80 : 260, transition: 'width 0.2s' }}>
        <div className="sidebar-header" style={{ marginBottom: 12 }}>
          <div style={{ background: 'var(--primary)', padding: '6px', borderRadius: '6px', color: 'white', display: 'flex' }}>
            <ShieldCheck size={20} />
          </div>
          {!isSidebarCollapsed && <span>SecureGate</span>}
          <div 
            style={{ marginLeft: 'auto', color: 'var(--text-muted)', cursor: 'pointer' }}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            <Menu size={20} />
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="sidebar-section">▼ Operations</div>
          <nav className="sidebar-nav">
            {operationsNav.map(item => (
              <a 
                key={item.id} 
                href="#"
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(item.id);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                {!isSidebarCollapsed && item.label}
                {!isSidebarCollapsed && item.badge && (
                  <span style={{ marginLeft: 'auto', background: 'var(--warning)', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>

          <div className="sidebar-section" style={{ marginTop: 8 }}>▼ Administration</div>
          <nav className="sidebar-nav">
            {adminNav.map(item => (
              <a 
                key={item.id} 
                href="#"
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(item.id);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                {!isSidebarCollapsed && item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* User Profile */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--bg-sidebar-hover)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0D2B24', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
            {fullProfile?.manager?.name?.substring(0, 2) || 'AM'}
          </div>
          {!isSidebarCollapsed && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'white' }}>{fullProfile?.manager?.name || 'Loading...'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-sidebar)' }}>{fullProfile?.role === 'MANAGER' ? 'Facility Manager' : 'Admin'}</div>
            </div>
          )}
          <button 
            onClick={handleLogout}
            title="Logout"
            style={{ marginLeft: 'auto', color: 'var(--text-sidebar)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
          >
            <LogOut size={16} />
          </button>
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
              <Bell size={18} />
              <span style={{ 
                position: 'absolute', top: 6, right: 6, 
                background: 'var(--warning)', borderRadius: '50%', 
                width: 6, height: 6 
              }}></span>
            </div>
            
            <div className="topbar-icon" onClick={() => setActiveTab('profile')} style={{ background: 'var(--primary-bg)', color: 'var(--primary)', cursor: 'pointer' }}>
              <User size={18} />
            </div>

            <div className="property-selector">
              <Building size={16} color="var(--text-muted)" />
              {fullProfile?.manager?.property?.name || 'Loading...'}
              <ChevronDown size={16} color="var(--text-muted)" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'guards' && <GuardManagement />}
          {activeTab === 'residents' && <ResidentDirectory />}
          {activeTab === 'timeline' && <EventTimeline />}
          {activeTab === 'alerts' && <AlertsEscalation />}
          {activeTab === 'expected' && <ExpectedVisitors />}
          {activeTab === 'community' && <CommunityControl />}
          {activeTab === 'reports' && <ReportsCompliance />}
          {activeTab === 'workforce' && <WorkforceMgmt />}
          {activeTab === 'profile' && <ManagerProfile />}
          {activeTab !== 'dashboard' && activeTab !== 'guards' && activeTab !== 'residents' && activeTab !== 'timeline' && activeTab !== 'alerts' && activeTab !== 'expected' && activeTab !== 'community' && activeTab !== 'reports' && activeTab !== 'workforce' && activeTab !== 'profile' && (
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
