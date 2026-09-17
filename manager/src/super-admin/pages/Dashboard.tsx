import React, { useState } from 'react';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import type { PlatformStatsResponse, DemoRequest } from '../types';
import { Icon } from '@iconify/react';

interface DashboardProps {
  stats: PlatformStatsResponse | null;
  onNavigate: (tab: string) => void;
  onOpenProvisionModal: (demo: DemoRequest) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, onNavigate, onOpenProvisionModal }) => {
  const [chartMetric, setChartMetric] = useState<'traffic' | 'revenue' | 'units'>('traffic');

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '360px' }}>
        <Icon icon="solar:restart-bold" className="animate-spin" width="32" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  const { metrics, recentDemos, recentSocieties, telemetry } = stats;

  // ponytail: Real-time telemetry series directly from backend database
  const activePoints = telemetry?.[chartMetric] || [];
  const maxVal = Math.max(1, ...activePoints.map((p) => p.val));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner with Quick Actions */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: 'var(--radius-md)',
        padding: '22px 26px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          right: '-5%',
          top: '-30%',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 200, 150, 0.25) 0%, transparent 70%)',
          filter: 'blur(30px)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              background: 'rgba(0, 200, 150, 0.2)',
              color: '#00C896',
              border: '1px solid rgba(0, 200, 150, 0.4)',
              fontSize: '0.675rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}>
              Platform Ecosystem
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{metrics.activeSocieties} Active Communities</span>
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF', marginBottom: '4px' }}>
            Multi-Tenant Platform Control Plane
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#CBD5E1', maxWidth: '600px' }}>
            Central monitoring for isolated tenant workspaces, automated lead conversions, and real-time gate telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 2 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('demos')}
            style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            <Icon icon="solar:user-hand-up-bold-duotone" width="16" />
            <span>Review Leads ({metrics.pendingDemos})</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('societies')}
          >
            <Icon icon="solar:add-circle-bold" width="16" />
            <span>Manage Societies</span>
          </button>
        </div>
      </div>

      {/* Metric Cards 6-Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard
          title="Total Societies"
          value={metrics.totalSocieties}
          icon="solar:buildings-3-bold-duotone"
          color="#00C896"
          trend="+100%"
          subtitle={`${metrics.activeSocieties} active workspaces`}
          badgeText="Active"
          badgeType="success"
        />
        <StatCard
          title="Pending Leads"
          value={metrics.pendingDemos}
          icon="solar:user-hand-up-bold-duotone"
          color="#F59E0B"
          subtitle="Inquiries awaiting review"
          badgeText={metrics.pendingDemos > 0 ? "Action Req" : "Up to date"}
          badgeType={metrics.pendingDemos > 0 ? "warning" : "neutral"}
        />
        <StatCard
          title="Managed Flats"
          value={metrics.totalUnits}
          icon="solar:home-smile-bold-duotone"
          color="#10B981"
          trend="+24.2%"
          subtitle={`${metrics.totalResidents} residents verified`}
          badgeText="Verified"
          badgeType="success"
        />
        <StatCard
          title="Security Staff"
          value={metrics.totalGuards}
          icon="solar:shield-user-bold-duotone"
          color="#0EA5E9"
          subtitle={`${metrics.totalManagers} Estate managers`}
          badgeText="Roster Active"
          badgeType="info"
        />
        <StatCard
          title="Today's Gate Passes"
          value={metrics.todayEntries}
          icon="solar:login-3-bold-duotone"
          color="#6366F1"
          subtitle={`${metrics.todayAlerts} SOS alerts raised`}
          badgeText="Live"
          badgeType="info"
        />
        <StatCard
          title="Monthly Run-Rate"
          value={`₹${(metrics.estimatedMRR / 1000).toFixed(1)}k`}
          icon="solar:card-recive-bold-duotone"
          color="#00C896"
          trend="+18.5%"
          subtitle="SaaS billing ARR estimate"
          badgeText="Healthy"
          badgeType="success"
        />
      </div>

      {/* Telemetry Chart Section */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon icon="solar:graph-up-bold" width="18" color="var(--primary)" />
              <span>Platform Activity & Growth Telemetry</span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Realtime trends across gated community nodes</p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px',
            gap: '2px',
          }}>
            <button
              onClick={() => setChartMetric('traffic')}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: chartMetric === 'traffic' ? '#FFFFFF' : 'transparent',
                color: chartMetric === 'traffic' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: chartMetric === 'traffic' ? 'var(--shadow-subtle)' : 'none',
                transition: 'all 0.12s ease',
              }}
            >
              Gate Traffic
            </button>
            <button
              onClick={() => setChartMetric('revenue')}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: chartMetric === 'revenue' ? '#FFFFFF' : 'transparent',
                color: chartMetric === 'revenue' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: chartMetric === 'revenue' ? 'var(--shadow-subtle)' : 'none',
                transition: 'all 0.12s ease',
              }}
            >
              MRR Growth
            </button>
            <button
              onClick={() => setChartMetric('units')}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: chartMetric === 'units' ? '#FFFFFF' : 'transparent',
                color: chartMetric === 'units' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: chartMetric === 'units' ? 'var(--shadow-subtle)' : 'none',
                transition: 'all 0.12s ease',
              }}
            >
              Flats Under Management
            </button>
          </div>
        </div>

        {/* Minimalist SVG Bar/Area Visualization */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activePoints.length}, 1fr)`, gap: '12px', alignItems: 'flex-end', height: '140px', paddingTop: '10px' }}>
          {activePoints.map((pt, idx) => {
            const heightPct = Math.max(15, (pt.val / maxVal) * 100);
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', fontFeatureSettings: '"tnum"' }}>
                  {chartMetric === 'revenue' ? `₹${(pt.val / 1000).toFixed(0)}k` : pt.val.toLocaleString()}
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '44px',
                    height: `${heightPct}%`,
                    background: idx === activePoints.length - 1
                      ? 'linear-gradient(180deg, #00C896 0%, #00A67C 100%)'
                      : 'linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.3s ease',
                    boxShadow: idx === activePoints.length - 1 ? '0 4px 12px rgba(0, 200, 150, 0.25)' : 'none',
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>{pt.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Dual Grid: Lead Funnel & Active Tenants */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        
        {/* Recent Demo Requests */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Demo Leads & Inquiries</h3>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Prospective societies requesting access</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('demos')}>
              View All ({metrics.pendingDemos})
            </button>
          </div>

          {recentDemos.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)' }}>
              <Icon icon="solar:inbox-line-bold" width="32" style={{ marginBottom: '6px', opacity: 0.5 }} />
              <div style={{ fontSize: '0.8rem' }}>No pending demo requests.</div>
            </div>
          ) : (
            <div className="data-table-container" style={{ border: 'none', borderRadius: '0' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Society / Lead</th>
                    <th>Units</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDemos.map((demo) => (
                    <tr key={demo.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{demo.societyName}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>{demo.contactName} • {demo.phone}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{demo.numberOfUnits || '—'}</td>
                      <td>
                        <StatusBadge status={demo.status} />
                      </td>
                      <td>
                        {demo.status === 'PENDING' || demo.status === 'CONTACTED' ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onOpenProvisionModal(demo)}
                            style={{ padding: '4px 9px', fontSize: '0.725rem' }}
                          >
                            <Icon icon="solar:check-circle-bold" width="13" />
                            Provision
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.725rem', color: 'var(--emerald)', fontWeight: 700 }}>Converted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Active Society Workspaces */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Society Workspaces</h3>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Registered gated community tenants</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('societies')}>
              All Societies
            </button>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentSocieties.map((society) => (
              <div
                key={society.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'var(--bg-card-subtle)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--emerald-bg)',
                    border: '1px solid var(--emerald-border)',
                    color: 'var(--primary-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    flexShrink: 0,
                  }}>
                    {society.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{society.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      <code>{society.slug || society.id.substring(0, 8)}</code> • {society.totalUnits} Units
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusBadge status={society.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
