import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { authService } from '../services/auth.service';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.login(email.trim(), password);
      // ponytail: brief smooth transition before navigating to dashboard
      await new Promise((resolve) => setTimeout(resolve, 350));
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please verify credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#060a09',
    }}>
      {/* Background Architectural Photo with Emerald & Deep Tint */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(135deg, rgba(6, 10, 9, 0.82) 0%, rgba(8, 22, 18, 0.75) 50%, rgba(6, 10, 9, 0.88) 100%),
          url('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=80')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'saturate(0.9) brightness(0.9)',
        zIndex: 0,
      }} />

      {/* Coverage Grid Accent */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 200, 150, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 200, 150, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 10%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 10%, transparent 80%)',
        zIndex: 1,
        pointerEvents: 'none',
      }} />

      {/* Split Card Container */}
      <div style={{
        width: '100%',
        maxWidth: '960px',
        minHeight: '560px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255, 255, 255, 0.9)',
        borderRadius: '24px',
        boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.45), 0 10px 30px rgba(0, 200, 150, 0.18)',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}>
        
        {/* Left Side — Society Showcase Visual with Emerald Glassmorphism */}
        <div style={{
          flex: 1.1,
          position: 'relative',
          padding: '44px 38px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundImage: `
            linear-gradient(160deg, rgba(6, 18, 14, 0.88) 0%, rgba(8, 30, 24, 0.92) 100%),
            url('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#ffffff',
          overflow: 'hidden',
        }}>
          {/* Ambient Glows */}
          <div style={{
            position: 'absolute',
            top: '-15%',
            right: '-15%',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 200, 150, 0.35) 0%, transparent 70%)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }} />

          {/* Top Brand Header */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '36px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #00C896 0%, #00A67C 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(0, 200, 150, 0.4)',
              }}>
                <Icon icon="solar:shield-star-bold" width="26" color="#ffffff" />
              </div>
              <div>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>SecureGate</span>
                <div style={{ fontSize: '0.675rem', color: '#00C896', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Platform Ecosystem</div>
              </div>
            </div>

            <h2 style={{
              fontSize: '2.1rem',
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: '16px',
              letterSpacing: '-0.03em',
              color: '#ffffff',
            }}>
              Intelligent<br />
              <span style={{ color: '#00C896' }}>Multi-Tenant</span><br />
              Community Security.
            </h2>

            <p style={{ fontSize: '0.925rem', color: '#cbd5e1', lineHeight: 1.6, maxWidth: '360px', marginBottom: '28px' }}>
              The central control panel governing all society workspaces, lead conversion pipelines, and cross-estate telemetry.
            </p>

            {/* Feature Pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#e2e8f0' }}>
                <Icon icon="solar:check-circle-bold" width="18" color="#00C896" />
                <span>One-Click Society & Manager Provisioning</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#e2e8f0' }}>
                <Icon icon="solar:check-circle-bold" width="18" color="#00C896" />
                <span>Strict Isolated Tenant Scoping (<code>societyId</code>)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#e2e8f0' }}>
                <Icon icon="solar:check-circle-bold" width="18" color="#00C896" />
                <span>Live Gate Traffic & Incident Telemetry</span>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div style={{ position: 'relative', zIndex: 2, fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            © {new Date().getFullYear()} SecureGate Inc. Platform Super Admin Plane.
          </div>
        </div>

        {/* Right Side — Login Space */}
        <div style={{
          flex: 1,
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.98)',
        }}>
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '6px' }}>
              Super Admin Login
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Enter your platform owner credentials to sign in.
            </p>
          </div>

          {error && (
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#FFF1F2',
              border: '1px solid #FECDD3',
              color: '#BE123C',
              fontSize: '0.825rem',
              fontWeight: 700,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 2px 8px rgba(225, 29, 72, 0.1)',
            }}>
              <Icon icon="solar:danger-circle-bold" width="20" style={{ color: '#E11D48', flexShrink: 0 }} />
              <span style={{ color: '#9F1239', lineHeight: 1.4, flex: 1 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} autoComplete="off">
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  className="input"
                  style={{
                    paddingLeft: '40px',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    borderColor: error ? '#FDA4AF' : '#CBD5E1',
                  }}
                  placeholder="superadmin@demo.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="off"
                />
                <Icon icon="solar:letter-bold" width="18" style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input"
                  style={{
                    paddingLeft: '40px',
                    paddingRight: '40px',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    borderColor: error ? '#FDA4AF' : '#CBD5E1',
                  }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="new-password"
                />
                <Icon icon="solar:lock-password-bold" width="18" style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />
                
                {/* Eye toggle button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} width="18" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '13px',
                marginTop: '8px',
                fontSize: '0.95rem',
                opacity: isLoading ? 0.85 : 1,
                cursor: isLoading ? 'wait' : 'pointer',
              }}
            >
              {isLoading ? (
                <>
                  <Icon icon="solar:restart-bold" className="animate-spin" width="18" />
                  <span>Launching Control Center...</span>
                </>
              ) : (
                <>
                  <Icon icon="solar:login-2-bold" width="18" />
                  <span>Access Control Panel</span>
                </>
              )}
            </button>
          </form>

          <div style={{
            marginTop: '24px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(0, 200, 150, 0.06)',
            border: '1px solid rgba(0, 200, 150, 0.15)',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <Icon icon="solar:shield-check-bold" width="16" color="#00C896" />
            <span>Platform Owner Control Plane. All actions are audited.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
