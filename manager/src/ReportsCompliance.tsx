import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { API_BASE } from './config';

const getAuthToken = () => localStorage.getItem('accessToken') || '';
const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function MonthlyReportsTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/reports/monthly/summary?month=${month}&year=${year}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setSummary(data.data ?? null))
      .finally(() => setLoading(false));
  }, [month, year]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/monthly?month=${month}&year=${year}`, { headers: authHeaders() });
      if (!res.ok) { alert('Failed to generate report'); return; }
      downloadBlob(await res.blob(), `security-report-${year}-${String(month).padStart(2, '0')}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const stats = summary ? [
    { title: 'Total Entries', value: summary.entries.total, icon: 'door-enter' },
    { title: 'Digital Entry Rate', value: `${summary.entries.digitalRate}%`, icon: 'device-mobile' },
    { title: 'Incidents Logged', value: summary.incidents.total, icon: 'alert-triangle', sub: `${summary.incidents.open} open · ${summary.incidents.closed} closed` },
    { title: 'Guard Shifts Completed', value: summary.guards.shiftsCompleted, icon: 'shield-check' },
    { title: 'Active Passes', value: summary.credentials.activePasses, icon: 'id-badge' },
    { title: 'Pass Anomalies', value: summary.credentials.anomalies.length, icon: 'flag', type: summary.credentials.anomalies.length > 0 ? 'warning' : 'positive' },
  ] : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 14 }}>
          {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 14 }}>
          {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn-primary" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDownload} disabled={downloading || loading}>
          <Icon name="download" size={14} /> {downloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {loading ? (
        <div className="card">Loading report…</div>
      ) : !summary ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data for this period.</div>
      ) : (
        <>
          <div className="stats-grid">
            {stats.map((s) => (
              <div key={s.title} className="stat-card">
                <div className="stat-icon"><Icon name={s.icon} size={16} /></div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-title">{s.title}</div>
                {s.sub && <div className={`stat-subtext ${s.type ?? ''}`}>{s.sub}</div>}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title"><div className="card-title-icon"><Icon name="chart-bar" size={16} /> Incidents by Type</div></div>
            {Object.keys(summary.incidents.byType).length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No incidents logged this period.</div>
            ) : (
              Object.entries(summary.incidents.byType as Record<string, number>).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                  <span>{type.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
              ))
            )}
          </div>

          {summary.credentials.anomalies.length > 0 && (
            <div className="card">
              <div className="card-title"><div className="card-title-icon"><Icon name="flag" size={16} /> Pass Anomalies — stale credentials (60+ days past validity, still active)</div></div>
              {summary.credentials.anomalies.map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                  <span>{p.resident?.name ?? 'Unknown resident'} · Unit {p.unit?.tower ? `${p.unit.tower} ` : ''}{p.unit?.unitNumber}</span>
                  <span style={{ color: 'var(--text-muted)' }}>expired {new Date(p.validUntil).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AuditTrailTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/reports/audit`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setLogs(data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = () => {
    const header = ['Timestamp', 'Actor', 'Role', 'Action', 'Entity', 'Entity ID'];
    const rows = logs.map((l) => [new Date(l.createdAt).toISOString(), l.actorName, l.actorRole, l.action, l.entity, l.entityId]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'audit-trail.csv');
  };

  if (loading) return <div className="card">Loading audit trail…</div>;

  return (
    <div>
      <div style={{ display: 'flex', marginBottom: 16 }}>
        <button className="btn btn-outline" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }} onClick={exportCsv} disabled={logs.length === 0}>
          <Icon name="file-download" size={14} /> Export CSV
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No audit activity recorded yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="table-header-row">
                {['Timestamp', 'Actor', 'Role', 'Action', 'Entity', 'Entity ID'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="table-row">
                  <td style={{ padding: '12px 16px' }}>{new Date(l.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.actorName}</td>
                  <td style={{ padding: '12px 16px' }}><span className="status-badge-modern">{l.actorRole}</span></td>
                  <td style={{ padding: '12px 16px' }}>{l.action}</td>
                  <td style={{ padding: '12px 16px' }}>{l.entity}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{l.entityId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ComplianceDashboardTab() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/reports/compliance`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setMetrics(data.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card">Loading compliance metrics…</div>;
  if (!metrics) return <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No compliance data available.</div>;

  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

  const stats = [
    { title: 'Alert Acknowledgement Rate', value: pct(metrics.alertAcknowledgementRate), sub: `${metrics.alertsTotal} alerts, last ${metrics.periodDays}d`, icon: 'circle-check' },
    { title: `P1 SLA Compliance (≤${metrics.p1SlaMinutes}min)`, value: pct(metrics.p1SlaComplianceRate), sub: `${metrics.p1AlertsTotal} P1 alerts, last ${metrics.periodDays}d`, icon: 'stopwatch', type: metrics.p1SlaComplianceRate !== null && metrics.p1SlaComplianceRate < 80 ? 'negative' : 'positive' },
    { title: 'Shift Handover Completion', value: pct(metrics.shiftHandoverCompletionRate), sub: `${metrics.shiftsCompleted} shifts, last ${metrics.periodDays}d`, icon: 'refresh' },
  ];

  return (
    <div>
      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.title} className="stat-card">
            <div className="stat-icon"><Icon name={s.icon} size={16} /></div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-title">{s.title}</div>
            <div className={`stat-subtext ${s.type ?? ''}`}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ReportsCompliance: React.FC = () => {
  const [tab, setTab] = useState<'monthly' | 'audit' | 'compliance'>('monthly');

  const tabs: { key: typeof tab; label: string; icon: React.ReactNode }[] = [
    { key: 'monthly', label: 'Monthly Reports', icon: <Icon name="file-text" size={15} /> },
    { key: 'audit', label: 'Audit Trail', icon: <Icon name="clipboard-list" size={15} /> },
    { key: 'compliance', label: 'Compliance Dashboard', icon: <Icon name="shield-check" size={15} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports & Compliance</h1>
        <p className="page-subtitle">Monthly operations reports, full audit trail, and live compliance metrics for Greenwood Towers</p>
      </div>

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 24, background: '#F1F5F9', padding: 4, borderRadius: 8 }}>
        {tabs.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'monthly' && <MonthlyReportsTab />}
      {tab === 'audit' && <AuditTrailTab />}
      {tab === 'compliance' && <ComplianceDashboardTab />}
    </div>
  );
};

export default ReportsCompliance;
