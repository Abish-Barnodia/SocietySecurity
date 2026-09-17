import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { superAdminService } from '../services/superAdmin.service';
import { SubscriptionPlanItem } from '../types';

export const Subscriptions: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanForSocieties, setSelectedPlanForSocieties] = useState<string | null>(null);

  const fetchPlans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await superAdminService.getSubscriptionPlans();
      setPlans(data || []);
    } catch (err: any) {
      console.error('Failed to load subscription plans', err);
      setError(err.message || 'Failed to fetch live subscription plans');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const totalMRR = plans.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);
  const totalSubscribedSocieties = plans.reduce((sum, p) => sum + (p.activeSocietiesCount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Aggregated Financials */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Platform Subscription Tiers
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time billing tiers, active society allocations, and monthly revenue run-rate
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Tenants:</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-dark)' }}>{totalSubscribedSocieties}</span>
          </div>

          <div style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--emerald-bg)',
            border: '1px solid var(--emerald-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--emerald)' }}>Estimated MRR:</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--emerald)' }}>
              ₹{totalMRR.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--rose-border)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <Icon icon="solar:restart-bold" className="animate-spin" width="32" style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: plan.isPopular ? '2px solid #8B5CF6' : '1px solid var(--border-color)',
                position: 'relative',
                overflow: 'hidden',
                padding: '24px',
              }}
            >
              {plan.isPopular && (
                <div style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: '#8B5CF6',
                  color: '#FFFFFF',
                  fontSize: '0.675rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Most Popular
                </div>
              )}

              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {plan.name}
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {plan.price}
                  </span>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-dim)' }}>{plan.billing}</span>
                </div>

                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: plan.color, marginBottom: '20px' }}>
                  {plan.unitLimit}
                </div>

                {/* Live Tier Metrics Box */}
                <div style={{
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  marginBottom: '20px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Subscribed Societies
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {plan.activeSocietiesCount} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500 }}>active</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Tier MRR
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--emerald)' }}>
                      ₹{plan.monthlyRevenue.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Feature List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      <Icon icon="solar:check-circle-bold" width="16" color={plan.color} style={{ flexShrink: 0 }} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subscribed Societies Drawer Toggle */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                {plan.societies.length > 0 ? (
                  <div>
                    <button
                      onClick={() => setSelectedPlanForSocieties(selectedPlanForSocieties === plan.id ? null : plan.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon icon="solar:buildings-3-bold" width="14" />
                        <span>View {plan.societies.length} Assigned Societies</span>
                      </span>
                      <Icon icon={selectedPlanForSocieties === plan.id ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} width="14" />
                    </button>

                    {selectedPlanForSocieties === plan.id && (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                        {plan.societies.map((soc) => (
                          <div key={soc.id} style={{ padding: '8px 10px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{soc.name}</span>
                            <code style={{ fontSize: '0.7rem' }}>{soc.totalUnits} flats</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                    No societies assigned to this tier yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
