export default function OpsMetricCard({ icon, label, value, tone }: { icon: string; label: string; value: number; tone?: 'danger' | 'warning' }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.icon, color: tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--warning)' : 'var(--accent-dark)' }}>{icon}</div>
      <div style={styles.value}>{value}</div>
      <div style={styles.label}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
    padding: 20, flex: '1 1 200px', minWidth: 180,
  },
  icon: { fontSize: 20, marginBottom: 10 },
  value: { fontSize: 28, fontWeight: 800 },
  label: { fontSize: 13, color: 'var(--text-muted)', marginTop: 4 },
};
