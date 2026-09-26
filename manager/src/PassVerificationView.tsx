import React, { useState, useEffect } from 'react';
import { API_BASE } from './config';
import Icon from './Icon';

export const PassVerificationView: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [verification, setVerification] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || params.get('qrPayload') || '';
    setToken(t);

    if (!t) {
      setLoading(false);
      setError('No verification token provided in URL.');
      return;
    }

    const fetchVerification = async () => {
      try {
        const res = await fetch(`${API_BASE}/passes/public-verify?token=${encodeURIComponent(t)}`);
        const data = await res.json();
        if (res.ok && data.status === 'success' && data.data) {
          setVerification(data.data);
        } else {
          setError(data.message || 'Unable to verify pass token.');
        }
      } catch (err: any) {
        console.error('Pass verification fetch error:', err);
        setError('Network error while connecting to security verification server.');
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, []);

  const pass = verification?.pass;
  const isValid = verification?.isValid;
  const status = verification?.status || 'INVALID';

  const getStatusColor = () => {
    if (status === 'ACTIVE' && isValid) return { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', icon: '#059669', label: 'Verified Active Pass — Clear for Entry' };
    if (status === 'EXPIRED') return { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '#DC2626', label: 'Pass Has Expired' };
    if (status === 'NOT_YET_VALID') return { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '#D97706', label: 'Pass Not Yet Valid' };
    return { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '#DC2626', label: 'Invalid / Unverified Pass' };
  };

  const statusStyle = getStatusColor();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8FAFC',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
      boxSizing: 'border-box'
    }}>
      {/* Top Header Branding */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20
      }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #00C896, #00A67C)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 200, 150, 0.3)'
        }}>
          <Icon name="shield-check" size={22} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>SecureGate</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#00A67C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Official Pass Verification</div>
        </div>
      </div>

      {/* Main Card Container */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="mgr-skeleton" style={{ width: 64, height: 64, borderRadius: '50%' }} />
            <div className="mgr-skeleton" style={{ width: 220, height: 22, borderRadius: 6 }} />
            <div className="mgr-skeleton" style={{ width: 320, height: 14, borderRadius: 4 }} />
            <div style={{ width: '100%', height: 1, backgroundColor: '#E2E8F0', margin: '16px 0' }} />
            <div className="mgr-skeleton" style={{ width: '100%', height: 100, borderRadius: 12 }} />
          </div>
        ) : error && !pass ? (
          <div style={{ padding: 36, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="alert-triangle" size={28} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>Pass Verification Failed</h3>
            <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.5, margin: '0 0 20px' }}>{error}</p>
            <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, fontSize: 12, color: '#94A3B8', wordBreak: 'break-all' }}>
              Token: {token ? `${token.substring(0, 32)}...` : 'None'}
            </div>
          </div>
        ) : pass ? (
          <div>
            {/* Status Banner */}
            <div style={{
              backgroundColor: statusStyle.bg,
              borderBottom: `1px solid ${statusStyle.border}`,
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'white',
                border: `1px solid ${statusStyle.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon name={isValid ? 'check' : 'alert-triangle'} size={20} color={statusStyle.icon} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: statusStyle.text }}>{statusStyle.label}</div>
                <div style={{ fontSize: 12, color: statusStyle.text, opacity: 0.9 }}>{pass.society.name}{pass.society.city ? ` • ${pass.society.city}` : ''}</div>
              </div>
            </div>

            <div style={{ padding: '24px 24px 28px' }}>
              {/* Host Resident Section */}
              <div style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 14,
                padding: '16px 18px',
                marginBottom: 20
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="building" size={14} color="#00A67C" /> Host Resident & Unit Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 2 }}>Host Name</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{pass.hostResident.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 2 }}>Apartment / Unit</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#00A67C' }}>{pass.unit.formattedUnit}</div>
                  </div>
                  {pass.hostResident.phone && (
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #E2E8F0', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#64748B' }}>Contact Resident:</span>
                      <a href={`tel:${pass.hostResident.phone}`} style={{ fontSize: 13, fontWeight: 600, color: '#00A67C', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="phone" size={14} /> {pass.hostResident.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Visitor Details Section */}
              <div style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 14,
                padding: '16px 18px',
                marginBottom: 20
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="users" size={14} color="#00A67C" /> Visitor & Pass Information
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748B' }}>Visitor Name:</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{pass.visitorName}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748B' }}>Visitor Phone:</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{pass.visitorPhone || 'Not provided'}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748B' }}>Pass Type:</span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      backgroundColor: '#ECFDF5',
                      color: '#065F46',
                      border: '1px solid #A7F3D0',
                      padding: '3px 10px',
                      borderRadius: 20
                    }}>
                      {pass.type}
                    </span>
                  </div>

                  {pass.purpose && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 13, color: '#64748B' }}>Purpose / Notes:</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#334155', maxWidth: '60%', textAlign: 'right' }}>{pass.purpose}</span>
                    </div>
                  )}

                  <div style={{ height: 1, backgroundColor: '#F1F5F9', margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>Valid From:</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                      {new Date(pass.validFrom).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>Valid Until:</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                      {new Date(pass.validUntil).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Verification Footer */}
              <div style={{
                textAlign: 'center',
                paddingTop: 8,
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Icon name="shield-check" size={14} color="#10B981" /> HMAC SHA256 Cryptographically Signed & Verified
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  Pass ID: <code>{pass.id.substring(0, 16)}...</code>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
        © {new Date().getFullYear()} SecureGate Security Platform. All rights reserved.
      </div>
    </div>
  );
};
