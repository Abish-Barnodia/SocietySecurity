import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import AlertsEscalationPage from './pages/AlertsEscalationPage';
import CommunityControlPage from './pages/CommunityControlPage';
import type { Page } from './components/Layout';

function Root() {
  const { isAuthenticated, isLoading } = useAuth();
  const [page, setPage] = useState<Page>('overview');

  if (isLoading) return null;
  if (!isAuthenticated) return <LoginPage />;
  if (page === 'community') return <CommunityControlPage onNavigate={setPage} />;
  if (page === 'alerts') return <AlertsEscalationPage onNavigate={setPage} />;
  return <OverviewPage onNavigate={setPage} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
