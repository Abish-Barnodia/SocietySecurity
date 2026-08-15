import Icon from './Icon';

// One consistent "nothing here yet" treatment — icon + message — used across
// every list/table in the app instead of each page inventing its own.
export default function EmptyState({ icon, message, compact }: { icon: string; message: string; compact?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: compact ? 28 : 48, color: 'var(--text-muted)' }}>
      <Icon name={icon} size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
      <p style={{ margin: 0, fontSize: 13 }}>{message}</p>
    </div>
  );
}
