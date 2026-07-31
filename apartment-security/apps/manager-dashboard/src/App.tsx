import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AlertsEscalationPage from './pages/AlertsEscalationPage';
import CommunityControlPage from './pages/CommunityControlPage';
import type { Page } from './components/Layout';

function Root() {
  const { isAuthenticated, isLoading } = useAuth();
  const [page, setPage] = useState<Page>('alerts');

  if (isLoading) return null;
  if (!isAuthenticated) return <LoginPage />;
  if (page === 'community') return <CommunityControlPage onNavigate={setPage} />;
  return <AlertsEscalationPage onNavigate={setPage} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
