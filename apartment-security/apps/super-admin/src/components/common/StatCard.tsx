import React from 'react';
import { Icon } from '@iconify/react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
  badgeText?: string;
  badgeType?: 'success' | 'warning' | 'info' | 'neutral';
  subtitle?: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = '#00C896',
  badgeText,
  badgeType = 'success',
  subtitle,
  trend,
}) => {
  return (
    <div className="metric-card">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{
            fontSize: '0.725rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {title}
          </span>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            background: `${color}14`,
            border: `1px solid ${color}30`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon icon={icon} width="18" />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            fontSize: '1.85rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            fontFeatureSettings: '"tnum"',
          }}>
            {value}
          </span>
          {trend && (
            <span style={{
              fontSize: '0.725rem',
              fontWeight: 700,
              color: 'var(--emerald)',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}>
              <Icon icon="solar:arrow-right-up-linear" width="12" />
              {trend}
            </span>
          )}
        </div>
      </div>

      <div style={{
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.725rem',
        color: 'var(--text-muted)',
      }}>
        <span>{subtitle || 'Realtime sync'}</span>
        {badgeText && (
          <span style={{
            fontWeight: 700,
            fontSize: '0.675rem',
            padding: '1px 6px',
            borderRadius: 'var(--radius-xs)',
            background: badgeType === 'success' ? 'var(--emerald-bg)' : badgeType === 'warning' ? 'var(--amber-bg)' : 'var(--bg-hover)',
            color: badgeType === 'success' ? '#065F46' : badgeType === 'warning' ? '#92400E' : 'var(--text-muted)',
            border: `1px solid ${badgeType === 'success' ? 'var(--emerald-border)' : badgeType === 'warning' ? 'var(--amber-border)' : 'var(--border-color)'}`,
          }}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
