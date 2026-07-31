import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import Layout, { Page } from '../components/Layout';

type Priority = 'P1' | 'P2' | 'P3';
type AlertStatus = 'SENT' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED';

type AlertItem = {
  id: string;
  priority: Priority;
  status: AlertStatus;
  title: string;
  body: string;
  createdAt: string;
  acknowledgedAt: string | null;
  entryId: string | null;
  incidentId: string | null;
};

type ChainStep = { order: number; roleLabel: string; name: string; delayMinutes: number; channel: string };
type Chain = { id: string; priority: Priority; steps: ChainStep[] };

const PRIORITY_STYLE: Record<Priority, { fg: string; bg: string }> = {
  P1: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  P2: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  P3: { fg: 'var(--accent-dark)', bg: '#ccfbf1' },
};

const STATUS_STYLE: Record<AlertStatus, { fg: string; bg: string; label: string }> = {
  SENT: { fg: 'var(--warning)', bg: 'var(--warning-bg)', label: 'open' },
  ESCALATED: { fg: 'var(--info)', bg: 'var(--info-bg)', label: 'escalated' },
  ACKNOWLEDGED: { fg: 'var(--text-muted)', bg: 'var(--neutral-bg)', label: 'acknowledged' },
  RESOLVED: { fg: 'var(--success)', bg: 'var(--success-bg)', label: 'resolved' },
};

const cleanTitle = (title: string) => title.replace(/^\[[A-Z_]+\]\s*/, '');

// Alert has no dedicated "source" field — derive an honest label from what
// actually created it, rather than inventing a system name.
const sourceLabel = (a: AlertItem) => (a.entryId ? 'Guard App' : a.incidentId ? 'Incident System' : 'System');

const formatElapsed = (seconds: number) => (seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`);

export default function AlertsEscalationPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | Priority>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AlertStatus>('ALL');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const load = useCallback(async () => {
    const [alertsRes, chainsRes] = await Promise.all([
      api.get('/alerts'),
      api.get('/escalation/chains'),
    ]);
    setAlerts(alertsRes.data.data ?? []);
    setChains(chainsRes.data.data ?? []);
    setLastRefreshedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleAcknowledge = async (id: string) => {
    setAckingId(id);
    try {
      await api.put(`/alerts/${id}/acknowledge`);
      setAlerts((cur) => cur.map((a) => (a.id === id ? { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: new Date().toISOString() } : a)));
    } finally {
      setAckingId(null);
    }
  };

  const filtered = useMemo(() => alerts.filter((a) =>
    (priorityFilter === 'ALL' || a.priority === priorityFilter) &&
    (statusFilter === 'ALL' || a.status === statusFilter)
  ), [alerts, priorityFilter, statusFilter]);

  const criticalActive = useMemo(
    () => alerts.filter((a) => a.priority === 'P1' && a.status !== 'ACKNOWLEDGED' && a.status !== 'RESOLVED').length,
    [alerts]
  );

  const refreshLabel = lastRefreshedAt ? formatElapsed(Math.floor((nowTick - lastRefreshedAt.getTime()) / 1000)) : '—';

  return (
    <Layout
      page="alerts"
      onNavigate={onNavigate}
      topBarExtra={
        <div style={styles.liveRow}>
          <span style={styles.liveDot} />
          <span>Live</span>
          <span style={{ color: 'var(--border)' }}>•</span>
          <span>Last refresh: {refreshLabel}</span>
        </div>
      }
    >
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Alerts & Escalation</h1>
          <p style={styles.subtitle}>Unified alert queue with escalation chain management — duress, incidents, overdue posts, and credential expiration</p>
        </div>
        <div style={styles.criticalPill}>
          <span style={{ ...styles.dot, background: criticalActive > 0 ? 'var(--danger)' : 'var(--border)' }} />
          {criticalActive} critical active
        </div>
      </div>

      <div style={styles.body}>
        <div style={styles.queueColumn}>
          <div style={styles.filterRow}>
            <select style={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="ALL">All Alerts</option>
              <option value="SENT">Open</option>
              <option value="ESCALATED">Escalated</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            <select style={styles.select} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}>
              <option value="ALL">All Priorities</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading alerts…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No alerts match this filter.</p>
          ) : (
            filtered.map((alert) => {
              const pStyle = PRIORITY_STYLE[alert.priority];
              const sStyle = STATUS_STYLE[alert.status];
              const acknowledged = alert.status === 'ACKNOWLEDGED' || alert.status === 'RESOLVED';
              return (
                <div key={alert.id} style={styles.card}>
                  <div style={{ ...styles.priorityBadge, color: pStyle.fg, background: pStyle.bg }}>{alert.priority}</div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.cardTitleRow}>
                      <span style={styles.cardTitle}>{cleanTitle(alert.title)}</span>
                      <span style={{ ...styles.statusBadge, color: sStyle.fg, background: sStyle.bg }}>{sStyle.label}</span>
                    </div>
                    <div style={styles.cardMeta}>
                      {new Date(alert.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {new Date(alert.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })} • {sourceLabel(alert)}
                    </div>
                  </div>
                  {!acknowledged && (
                    <button style={styles.ackButton} onClick={() => handleAcknowledge(alert.id)} disabled={ackingId === alert.id}>
                      {ackingId === alert.id ? '…' : 'Acknowledge'}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div style={styles.chainColumn}>
          <h2 style={styles.chainHeading}>Escalation Chains</h2>
          {(['P1', 'P2', 'P3'] as Priority[]).map((priority) => {
            const chain = chains.find((c) => c.priority === priority);
            const pStyle = PRIORITY_STYLE[priority];
            return (
              <div key={priority} style={styles.chainCard}>
                <div style={{ ...styles.chainTitle, color: pStyle.fg }}>
                  Priority {priority.slice(1)} — {priority === 'P1' ? 'Critical' : priority === 'P2' ? 'Urgent' : 'Routine'}
                </div>
                {!chain || chain.steps.length === 0 ? (
                  <p style={styles.chainEmpty}>No escalation contacts configured for this priority yet.</p>
                ) : (
                  chain.steps.map((step) => (
                    <div key={step.order} style={styles.stepRow}>
                      <span style={styles.stepOrder}>{step.order}</span>
                      <div style={{ flex: 1 }}>
                        <div style={styles.stepRole}>{step.roleLabel} — {step.name}</div>
                      </div>
                      <span style={styles.stepDelay}>{step.delayMinutes === 0 ? 'Immediate' : `+${step.delayMinutes}m`}</span>
                      <span style={styles.stepChannel}>{step.channel}</span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  liveRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, background: 'var(--success)', display: 'inline-block' },

  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0', maxWidth: 640 },
  criticalPill: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  dot: { width: 6, height: 6, borderRadius: 3, display: 'inline-block' },

  body: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  queueColumn: { flex: 1, minWidth: 0 },
  filterRow: { display: 'flex', gap: 12, marginBottom: 16 },
  select: {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--card)', fontSize: 13, color: 'var(--text)',
  },

  card: {
    display: 'flex', alignItems: 'flex-start', gap: 14, background: 'var(--card)',
    border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12,
  },
  priorityBadge: { fontSize: 12, fontWeight: 800, borderRadius: 8, padding: '4px 8px', flexShrink: 0 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardTitle: { fontWeight: 700, fontSize: 14.5 },
  statusBadge: { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 10px' },
  cardMeta: { fontSize: 12, color: 'var(--text-muted)', marginTop: 4 },
  ackButton: {
    background: 'var(--accent-dark)', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 14px', fontSize: 12.5, fontWeight: 700, flexShrink: 0,
  },

  chainColumn: { width: 340, flexShrink: 0 },
  chainHeading: { fontSize: 16, fontWeight: 800, margin: '0 0 12px' },
  chainCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 },
  chainTitle: { fontWeight: 800, fontSize: 13, marginBottom: 10 },
  chainEmpty: { fontSize: 12.5, color: 'var(--text-muted)', margin: 0 },
  stepRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' },
  stepOrder: {
    width: 18, height: 18, borderRadius: '50%', background: 'var(--neutral-bg)', color: 'var(--text-muted)',
    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepRole: { fontSize: 12.5, fontWeight: 600 },
  stepDelay: { fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 },
  stepChannel: { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 },
};
