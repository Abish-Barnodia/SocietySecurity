import React from 'react';
import { Icon } from '@iconify/react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
  onRefresh,
  isLoading,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="topbar">
      {/* Left: Breadcrumbs & Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          <span>Platform</span>
          <Icon icon="solar:alt-arrow-right-linear" width="12" />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{title}</span>
          {subtitle && (
            <>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions & Cluster Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        
        {/* Dark Mode Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="btn btn-secondary btn-sm"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          style={{
            padding: '6px 10px',
            fontSize: '0.775rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Icon
            icon={theme === 'light' ? 'solar:moon-stars-bold-duotone' : 'solar:sun-2-bold-duotone'}
            width="16"
            style={{ color: theme === 'light' ? 'var(--indigo)' : '#F59E0B' }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </span>
        </button>

        {/* Quick Sync Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn btn-secondary btn-sm"
            title="Sync live telemetry from DB"
            style={{ padding: '6px 12px', fontSize: '0.775rem' }}
          >
            <Icon icon="solar:restart-bold" width="14" className={isLoading ? 'animate-spin' : ''} style={{ color: 'var(--primary-dark)' }} />
            <span>Sync</span>
          </button>
        )}

        {/* Live Cluster Health */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--emerald-bg)',
          border: '1px solid var(--emerald-border)',
          fontSize: '0.725rem',
          fontWeight: 700,
          color: 'var(--emerald)',
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--primary)',
            display: 'inline-block',
            boxShadow: '0 0 6px var(--primary)',
          }} />
          Cluster Online
        </div>
      </div>
    </header>
  );
};
