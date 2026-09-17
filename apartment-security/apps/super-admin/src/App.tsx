import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Societies } from './pages/Societies';
import { DemoRequests } from './pages/DemoRequests';
import { Managers } from './pages/Managers';
import { Subscriptions } from './pages/Subscriptions';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';
import { ProvisionSocietyModal } from './components/societies/ProvisionSocietyModal';
import { authService } from './services/auth.service';
import { superAdminService } from './services/superAdmin.service';
import { PlatformStatsResponse, DemoRequest } from './types';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!authService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [provisioningDemo, setProvisioningDemo] = useState<DemoRequest | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('superadmin_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('superadmin_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const fetchStats = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const data = await superAdminService.getPlatformStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch platform metrics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const getPageMeta = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Platform Control Center', subtitle: 'Live ecosystem metrics and high-level health' };
      case 'societies':
        return { title: 'Societies & Tenants', subtitle: 'Active gated communities, flat limits & status' };
      case 'demos':
        return { title: 'Demo Inquiries & Leads', subtitle: 'Review and approve society requests for 1-click onboarding' };
      case 'managers':
        return { title: 'Global Estate Managers', subtitle: 'Active manager accounts across all registered societies' };
      case 'subscriptions':
        return { title: 'Subscription Plans & Tiers', subtitle: 'Manage billing tiers and feature allowances' };
      case 'audit':
        return { title: 'Platform Audit Trail', subtitle: 'Administrative logs and tenant lifecycle mutations' };
      case 'settings':
        return { title: 'System & Gateway Settings', subtitle: 'SMTP, WhatsApp Business and integration parameters' };
      default:
        return { title: 'Super Admin', subtitle: '' };
    }
  };

  const meta = getPageMeta();

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingDemosCount={stats?.metrics.pendingDemos}
      />

      <main className="main-content">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          onRefresh={fetchStats}
          isLoading={isLoading}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <div className="page-body">
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenProvisionModal={(demo) => setProvisioningDemo(demo)}
            />
          )}

          {activeTab === 'societies' && <Societies />}

          {activeTab === 'demos' && (
            <DemoRequests onDemosUpdated={fetchStats} />
          )}

          {activeTab === 'managers' && <Managers />}

          {activeTab === 'subscriptions' && <Subscriptions />}

          {activeTab === 'audit' && <AuditLogs />}

          {activeTab === 'settings' && <Settings />}
        </div>
      </main>

      {/* Global Provisioning Modal Triggerable from anywhere */}
      {provisioningDemo && (
        <ProvisionSocietyModal
          isOpen={!!provisioningDemo}
          onClose={() => setProvisioningDemo(null)}
          demoRequest={provisioningDemo}
          onSuccess={() => {
            fetchStats();
            setProvisioningDemo(null);
          }}
        />
      )}
    </div>
  );
};
