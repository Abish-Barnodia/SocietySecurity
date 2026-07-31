import { useEffect, useState } from 'react';
import api from '../../utils/api';

type Report = {
  id: string;
  reason: string;
  createdAt: string;
  reporter: { resident: { name: string; unit: { unitNumber: string; tower: string | null } | null } | null };
  message: {
    id: string;
    body: string | null;
    type: string;
    sender: { resident: { name: string; unit: { unitNumber: string; tower: string | null } | null } | null };
  };
};

export default function CommunityFlaggedTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    api.get('/community/reports').then((res) => {
      setReports(res.data.data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const dismiss = async (report: Report) => {
    setBusyId(report.id);
    try {
      await api.post(`/community/reports/${report.id}/dismiss`);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } finally {
      setBusyId(null);
    }
  };

  const removeMessage = async (report: Report) => {
    setBusyId(report.id);
    try {
      await api.delete(`/community/messages/${report.message.id}`).catch(() => {});
      await api.post(`/community/reports/${report.id}/resolve`);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading flagged content…</p>;
  if (reports.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No pending reports. The community feed is clean.</p>;

  return (
    <div>
      {reports.map((r) => {
        const reporter = r.reporter.resident;
        const sender = r.message.sender.resident;
        return (
          <div key={r.id} style={styles.card}>
            <div style={styles.headerRow}>
              <div>
                <div style={styles.senderLine}>{sender?.name ?? 'Unknown'} {sender?.unit ? `· ${sender.unit.tower ? sender.unit.tower + ' ' : ''}${sender.unit.unitNumber}` : ''}</div>
                <div style={styles.meta}>
                  Flagged by {reporter?.name ?? 'a resident'} on {new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              <span style={styles.pendingBadge}>pending</span>
            </div>

            <p style={styles.reason}><strong>Reason:</strong> {r.reason}</p>
            {r.message.body && <p style={styles.messageBody}>"{r.message.body}"</p>}

            <div style={styles.actions}>
              <button style={styles.dismissButton} onClick={() => dismiss(r)} disabled={busyId === r.id}>Dismiss</button>
              <button style={styles.removeButton} onClick={() => removeMessage(r)} disabled={busyId === r.id}>Delete Message</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  senderLine: { fontWeight: 700, fontSize: 13.5, color: 'var(--text)' },
  meta: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  pendingBadge: {
    fontSize: 11, fontWeight: 700, background: 'var(--warning-bg)', color: 'var(--warning)',
    padding: '3px 9px', borderRadius: 999, flexShrink: 0,
  },
  reason: { fontSize: 13.5, margin: '12px 0 6px', color: 'var(--text)' },
  messageBody: { fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 12px' },
  actions: { display: 'flex', gap: 10 },
  dismissButton: {
    fontSize: 12.5, fontWeight: 700, color: 'var(--accent-dark)', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px',
  },
  removeButton: {
    fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'var(--danger)',
    border: 'none', borderRadius: 8, padding: '7px 14px',
  },
};
