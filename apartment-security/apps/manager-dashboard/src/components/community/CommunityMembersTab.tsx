import { useEffect, useState } from 'react';
import api from '../../utils/api';

type Member = {
  id: string;
  name: string;
  unit: { unitNumber: string; tower: string | null } | null;
  role: 'admin' | 'member';
  joinedAt: string;
  postCount: number;
  muted: boolean;
  active: boolean;
};

export default function CommunityMembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = () => {
    api.get('/community/members/manage').then((res) => {
      setMembers(res.data.data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const toggleMute = async (member: Member) => {
    setTogglingId(member.id);
    const nextMuted = !member.muted;
    try {
      await api.put(`/community/members/${member.id}/mute`, { muted: nextMuted });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, muted: nextMuted } : m)));
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading members…</p>;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['Member', 'Unit', 'Role', 'Joined', 'Posts', 'Chat', 'Status'].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} style={styles.tr}>
              <td style={styles.td}><strong>{m.name}</strong></td>
              <td style={styles.td}>{m.unit ? `${m.unit.tower ? m.unit.tower + ' ' : ''}${m.unit.unitNumber}` : '—'}</td>
              <td style={styles.td}>
                <span style={styles.roleBadge}>{m.role}</span>
              </td>
              <td style={styles.td}>{new Date(m.joinedAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td style={styles.td}>{m.postCount}</td>
              <td style={styles.td}>
                <button
                  onClick={() => toggleMute(m)}
                  disabled={togglingId === m.id}
                  style={{ ...styles.toggle, ...(m.muted ? {} : styles.toggleOn) }}
                  title={m.muted ? 'Muted — tap to allow posting' : 'Can post — tap to mute'}
                >
                  <span style={{ ...styles.toggleKnob, ...(m.muted ? {} : styles.toggleKnobOn) }} />
                </button>
              </td>
              <td style={styles.td}>
                <span style={{ ...styles.statusBadge, ...(m.muted ? styles.statusMuted : styles.statusActive) }}>
                  {m.muted ? 'muted' : 'active'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tableWrap: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: {
    textAlign: 'left', padding: '12px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: 0.4, borderBottom: '1px solid var(--border)', background: 'var(--bg)',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '12px 16px', color: 'var(--text)' },
  roleBadge: {
    fontSize: 11, fontWeight: 700, background: 'var(--neutral-bg)', color: 'var(--text-muted)',
    padding: '3px 9px', borderRadius: 999,
  },
  toggle: {
    width: 38, height: 21, borderRadius: 999, border: 'none', background: 'var(--border)',
    position: 'relative', cursor: 'pointer', padding: 0,
  },
  toggleOn: { background: 'var(--accent)' },
  toggleKnob: {
    position: 'absolute', top: 2, left: 2, width: 17, height: 17, borderRadius: '50%',
    background: '#fff', transition: 'left 120ms ease',
  },
  toggleKnobOn: { left: 19 },
  statusBadge: { fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999 },
  statusActive: { background: 'var(--success-bg)', color: 'var(--success)' },
  statusMuted: { background: 'var(--warning-bg)', color: 'var(--warning)' },
};
