import React from 'react';
import { Icon } from '@iconify/react';
import { authService } from '../../services/auth.service';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDemosCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, pendingDemosCount = 0 }) => {
  const user = authService.getCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // ponytail: smooth visual logout loading feedback
    await new Promise((resolve) => setTimeout(resolve, 350));
    authService.logout();
  };

  const sections = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'solar:widget-5-bold-duotone' },
        { id: 'societies', label: 'Societies & Tenants', icon: 'solar:buildings-3-bold-duotone' },
        {
          id: 'demos',
          label: 'Demo Leads',
          icon: 'solar:user-hand-up-bold-duotone',
          badge: pendingDemosCount > 0 ? pendingDemosCount : undefined,
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { id: 'managers', label: 'Estate Managers', icon: 'solar:users-group-two-rounded-bold-duotone' },
        { id: 'subscriptions', label: 'Subscription Tiers', icon: 'solar:card-recive-bold-duotone' },
        { id: 'audit', label: 'Platform Audit Trail', icon: 'solar:shield-check-bold-duotone' },
      ],
    },
    {
      title: 'CONFIGURATION',
      items: [
        { id: 'settings', label: 'System Settings', icon: 'solar:settings-minimalistic-bold-duotone' },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div style={{
        padding: '18px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #00C896 0%, #008764 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 200, 150, 0.3)',
            flexShrink: 0,
          }}>
            <Icon icon="solar:shield-star-bold" width="20" color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.975rem', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
              SecureGate
            </div>
            <div style={{ fontSize: '0.65rem', color: '#008764', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Super Admin
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          background: 'var(--primary-light)',
          color: 'var(--primary-dark)',
          border: '1px solid var(--primary-border)',
          padding: '2px 6px',
          borderRadius: 'var(--radius-xs)',
          letterSpacing: '0.04em'
        }}>
          v2.4
        </span>
      </div>

      {/* Navigation Sections */}
      <div style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        {sections.map((sec, secIdx) => (
          <div key={secIdx}>
            <div style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
              padding: '0 10px 8px 10px',
              textTransform: 'uppercase',
            }}>
              {sec.title}
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {sec.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--primary-border)' : 'transparent',
                      cursor: 'pointer',
                      background: isActive ? 'var(--primary-light)' : 'transparent',
                      color: isActive ? 'var(--primary-dark)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.825rem',
                      transition: 'all 0.12s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icon
                        icon={item.icon}
                        width="18"
                        style={{ color: isActive ? 'var(--primary-dark)' : 'var(--text-muted)' }}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span style={{
                        background: 'var(--rose)',
                        color: '#ffffff',
                        fontSize: '0.675rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        minWidth: '18px',
                        textAlign: 'center',
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* User Footer Profile */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-card-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--emerald-bg)',
            border: '1px solid var(--emerald-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.75rem',
            color: 'var(--primary-dark)',
            flexShrink: 0,
          }}>
            SA
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email || 'Platform Owner'}
            </div>
            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Super Admin</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={isLoggingOut ? 'Signing Out...' : 'Sign Out'}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: isLoggingOut ? 'var(--primary-dark)' : 'var(--text-muted)',
            cursor: isLoggingOut ? 'wait' : 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isLoggingOut) {
              e.currentTarget.style.borderColor = 'var(--rose-border)';
              e.currentTarget.style.color = 'var(--rose)';
              e.currentTarget.style.background = 'var(--rose-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoggingOut) {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.background = 'var(--bg-card)';
            }
          }}
        >
          <Icon
            icon={isLoggingOut ? 'solar:restart-bold' : 'solar:logout-2-bold'}
            className={isLoggingOut ? 'animate-spin' : ''}
            width="15"
          />
        </button>
      </div>
    </aside>
  );
};
