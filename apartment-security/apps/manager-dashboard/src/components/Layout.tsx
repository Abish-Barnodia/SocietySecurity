import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export type Page = 'alerts' | 'community';

const NAV_SECTIONS: { label: string; items: { icon: string; label: string; page?: Page }[] }[] = [
  {
    label: 'Operations',
    items: [
      { icon: '▦', label: 'Dashboard' },
      { icon: '🛡️', label: 'Guard Management' },
      { icon: '📇', label: 'Resident Directory' },
      { icon: '🕐', label: 'Event Timeline' },
      { icon: '⚠️', label: 'Alerts & Escalation', page: 'alerts' },
      { icon: '🚗', label: 'Expected Visitors' },
      { icon: '🅿️', label: 'Parking & Vehicles' },
      { icon: '📷', label: 'CCTV Monitoring' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { icon: '📄', label: 'Reports' },
      { icon: '👥', label: 'Community Control', page: 'community' },
      { icon: '📅', label: 'Workforce Mgmt' },
      { icon: '⚙️', label: 'Settings' },
    ],
  },
];

export default function Layout({ children, topBarExtra, page, onNavigate }: {
  children: ReactNode;
  topBarExtra?: ReactNode;
  page: Page;
  onNavigate: (page: Page) => void;
}) {
  const { managerProfile, logout } = useAuth();

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brandRow}>
          <div style={styles.brandIcon}>🛡️</div>
          <span style={styles.brandText}>SecureGate</span>
        </div>

        <nav style={styles.nav}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} style={{ marginBottom: 20 }}>
              <div style={styles.sectionLabel}>{section.label.toUpperCase()}</div>
              {section.items.map((item) => {
                const active = !!item.page && item.page === page;
                const clickable = !!item.page;
                return (
                  <div
                    key={item.label}
                    onClick={clickable ? () => onNavigate(item.page!) : undefined}
                    style={{
                      ...styles.navItem,
                      ...(active ? styles.navItemActive : {}),
                      ...(clickable ? { cursor: 'pointer' } : {}),
                    }}
                  >
                    <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <button style={styles.profileRow} onClick={logout} title="Log out">
          <div style={styles.avatar}>{(managerProfile?.name ?? '?').charAt(0).toUpperCase()}</div>
          <div style={{ textAlign: 'left' }}>
            <div style={styles.profileName}>{managerProfile?.name}</div>
            <div style={styles.profileRole}>Manager</div>
          </div>
        </button>
      </aside>

      <div style={styles.main}>
        <header style={styles.topBar}>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {topBarExtra}
            <div style={styles.propertyPill}>🏢 {managerProfile?.propertyName}</div>
          </div>
        </header>
        <main style={styles.content}>{children}</main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', height: '100%' },
  sidebar: {
    width: 260, background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '20px 20px 16px' },
  brandIcon: {
    width: 28, height: 28, borderRadius: 8, background: 'var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
  },
  brandText: { color: '#fff', fontWeight: 800, fontSize: 16 },
  nav: { flex: 1, overflowY: 'auto', padding: '8px 12px' },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#5b6270',
    padding: '0 12px', marginBottom: 6,
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
    borderRadius: 8, fontSize: 13.5, color: 'var(--sidebar-text)',
  },
  navItemActive: {
    background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-text-active)', fontWeight: 700,
  },
  profileRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 16,
    borderTop: '1px solid var(--sidebar-border)', background: 'transparent', border: 'none',
    borderRadius: 0, width: '100%',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dark)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
  },
  profileName: { color: '#fff', fontSize: 13, fontWeight: 700 },
  profileRole: { color: 'var(--sidebar-text)', fontSize: 11 },

  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topBar: {
    display: 'flex', alignItems: 'center', padding: '12px 24px', background: 'var(--card)',
    borderBottom: '1px solid var(--border)',
  },
  propertyPill: {
    fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'var(--neutral-bg)',
    padding: '6px 12px', borderRadius: 999,
  },
  content: { flex: 1, overflowY: 'auto', padding: 32 },
};
