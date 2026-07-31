import { useState } from 'react';
import Layout, { Page } from '../components/Layout';
import CommunityFeedTab from '../components/community/CommunityFeedTab';
import CommunityMembersTab from '../components/community/CommunityMembersTab';
import CommunityFlaggedTab from '../components/community/CommunityFlaggedTab';

type Tab = 'feed' | 'members' | 'flagged';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'feed', label: 'Community Feed', icon: '💬' },
  { key: 'members', label: 'Members', icon: '👥' },
  { key: 'flagged', label: 'Flagged Content', icon: '🚩' },
];

export default function CommunityControlPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [tab, setTab] = useState<Tab>('feed');

  return (
    <Layout page="community" onNavigate={onNavigate}>
      <h1 style={styles.title}>Community Control</h1>
      <p style={styles.subtitle}>Community feed moderation, member management, flagged content review, and chat toggle administration</p>

      <div style={styles.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.key}
            style={{ ...styles.tabButton, ...(tab === t.key ? styles.tabButtonActive : {}) }}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'feed' && <CommunityFeedTab />}
      {tab === 'members' && <CommunityMembersTab />}
      {tab === 'flagged' && <CommunityFlaggedTab />}
    </Layout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: 26, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 24px', maxWidth: 680 },

  tabRow: { display: 'flex', gap: 8, marginBottom: 20 },
  tabButton: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
    color: 'var(--text-muted)', background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '9px 16px',
  },
  tabButtonActive: { color: 'var(--text)', background: 'var(--neutral-bg)', borderColor: 'var(--text-muted)' },
};
