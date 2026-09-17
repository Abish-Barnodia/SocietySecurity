import React from 'react';
import { Icon } from '@iconify/react';
import { authService } from '../../services/auth.service';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDemosCount?: number;
  onLogout?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingDemosCount = 0,
  onLogout,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const user = authService.getCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (onLogout) {
      onLogout();
    } else {
      authService.logout();
    }
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
    <aside
      className="sa-sidebar"
      style={{
        width: isCollapsed ? 72 : 260,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: isCollapsed ? '16px 12px' : '18px 20px',
          borderBottom: '1px solid var(--sa-border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          height: '64px',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #00C896 0%, #008764 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 200, 150, 0.3)',
              flexShrink: 0,
            }}
          >
            <Icon icon="solar:shield-star-bold" width="20" color="#ffffff" />
          </div>

          {!isCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '0.975rem',
                  letterSpacing: '-0.02em',
                  color: 'var(--sa-text-primary)',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                }}
              >
                SecureGate
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: '#008764',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Super Admin
              </div>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--sa-text-dim)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s, background 0.15s',
              marginLeft: isCollapsed ? 0 : 'auto',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#00C896';
              e.currentTarget.style.background = 'rgba(0,200,150,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--sa-text-dim)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon icon="solar:hamburger-menu-linear" width="20" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div
        style={{
          padding: isCollapsed ? '16px 8px' : '16px 12px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: isCollapsed ? '12px' : '20px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {sections.map((sec, secIdx) => (
          <div key={secIdx}>
            {!isCollapsed ? (
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: 'var(--sa-text-dim)',
                  letterSpacing: '0.08em',
                  padding: '0 10px 8px 10px',
                  textTransform: 'uppercase',
                }}
              >
                {sec.title}
              </div>
            ) : (
              <div style={{ height: secIdx === 0 ? 0 : 8, borderTop: secIdx === 0 ? 'none' : '1px solid var(--sa-border-color)', margin: '4px 6px' }} />
            )}

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {sec.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      width: '100%',
                      padding: isCollapsed ? '10px 0' : '8px 12px',
                      borderRadius: 'var(--sa-radius-sm)',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--sa-primary-border)' : 'transparent',
                      cursor: 'pointer',
                      background: isActive ? 'var(--sa-primary-light)' : 'transparent',
                      color: isActive ? 'var(--sa-primary-dark)' : 'var(--sa-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.825rem',
                      transition: 'all 0.12s ease',
                      textAlign: 'left',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--sa-bg-hover)';
                        e.currentTarget.style.color = 'var(--sa-text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--sa-text-secondary)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                      <Icon
                        icon={item.icon}
                        width="18"
                        style={{ color: isActive ? 'var(--sa-primary-dark)' : 'var(--sa-text-muted)', flexShrink: 0 }}
                      />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>

                    {item.badge !== undefined && (
                      !isCollapsed ? (
                        <span
                          style={{
                            background: 'var(--sa-rose)',
                            color: '#ffffff',
                            fontSize: '0.675rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--sa-radius-full)',
                            minWidth: '18px',
                            textAlign: 'center',
                          }}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        <span
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 8,
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: 'var(--sa-rose)',
                            border: '1.5px solid var(--sa-bg-sidebar)',
                          }}
                        />
                      )
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* User Footer Profile */}
      <div
        style={{
          padding: isCollapsed ? '12px 8px' : '12px 16px',
          borderTop: '1px solid var(--sa-border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          background: 'var(--sa-bg-card-subtle)',
          flexDirection: isCollapsed ? 'column' : 'row',
          gap: isCollapsed ? 8 : 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--sa-radius-sm)',
              background: 'var(--sa-emerald-bg)',
              border: '1px solid var(--sa-emerald-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'var(--sa-primary-dark)',
              flexShrink: 0,
            }}
            title={isCollapsed ? (user?.email || 'Platform Owner') : undefined}
          >
            SA
          </div>
          {!isCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--sa-text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.email || 'Platform Owner'}
              </div>
              <div style={{ fontSize: '0.675rem', color: 'var(--sa-text-muted)' }}>Super Admin</div>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={isLoggingOut ? 'Signing Out...' : 'Sign Out'}
          style={{
            background: 'var(--sa-bg-card)',
            border: '1px solid var(--sa-border-color)',
            color: isLoggingOut ? 'var(--sa-primary-dark)' : 'var(--sa-text-muted)',
            cursor: isLoggingOut ? 'wait' : 'pointer',
            padding: '6px',
            borderRadius: 'var(--sa-radius-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isLoggingOut) {
              e.currentTarget.style.borderColor = 'var(--sa-rose-border)';
              e.currentTarget.style.color = 'var(--sa-rose)';
              e.currentTarget.style.background = 'var(--sa-rose-bg)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoggingOut) {
              e.currentTarget.style.borderColor = 'var(--sa-border-color)';
              e.currentTarget.style.color = 'var(--sa-text-muted)';
              e.currentTarget.style.background = 'var(--sa-bg-card)';
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
