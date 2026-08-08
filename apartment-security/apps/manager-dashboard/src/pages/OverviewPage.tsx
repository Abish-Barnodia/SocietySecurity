import { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import Layout, { Page } from '../components/Layout';
import OpsMetricCard from '../components/OpsMetricCard';

type Overview = {
  totalEntriesToday: number;
  activeVisitors: number;
  guardsOnDuty: number;
  openIncidents: number;
  unacknowledgedAlerts: number;
  pendingWalkins: number;
};

export default function OverviewPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await api.get('/reports/overview');
    setData(res.data.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <Layout page="overview" onNavigate={onNavigate}>
      <h1 style={styles.title}>Dashboard</h1>
      <p style={styles.subtitle}>Live operations snapshot for your property</p>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={styles.grid}>
          <OpsMetricCard icon="🚪" label="Entries today" value={data!.totalEntriesToday} />
          <OpsMetricCard icon="🚶" label="Active visitors" value={data!.activeVisitors} />
          <OpsMetricCard icon="🛡️" label="Guards on duty" value={data!.guardsOnDuty} />
          <OpsMetricCard icon="⚠️" label="Open incidents" value={data!.openIncidents} tone={data!.openIncidents > 0 ? 'warning' : undefined} />
          <OpsMetricCard icon="🔔" label="Unacknowledged alerts" value={data!.unacknowledgedAlerts} tone={data!.unacknowledgedAlerts > 0 ? 'danger' : undefined} />
          <OpsMetricCard icon="⏳" label="Pending walk-ins" value={data!.pendingWalkins} />
        </div>
      )}
    </Layout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: 26, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 24px' },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 16 },
};
