import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import PasswordInput from './PasswordInput';
import { API_BASE } from './config';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

interface SocietyOption {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  address?: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // Mode: 'login' | 'forgot-request' | 'forgot-reset'
  const [view, setView] = useState<'login' | 'forgot-request' | 'forgot-reset'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password form state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Society selection & autocomplete states
  const [societies, setSocieties] = useState<SocietyOption[]>([]);
  const [selectedSociety, setSelectedSociety] = useState<SocietyOption | null>(null);
  const [societySearch, setSocietySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [societiesLoading, setSocietiesLoading] = useState(true);
  const [societyLoadError, setSocietyLoadError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ensure clean crisp login styling by resetting any portal theme attribute
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
  }, []);

  // Load public registered societies
  useEffect(() => {
    const fetchSocieties = async () => {
      setSocietiesLoading(true);
      setSocietyLoadError(false);
      try {
        const res = await fetch(`${API_BASE}/auth/societies`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.data)) {
          setSocieties(data.data);

          // Auto-select from URL query (?slug=...) if provided
          const params = new URLSearchParams(window.location.search);
          const slugParam = params.get('slug');
          if (slugParam) {
            const found = data.data.find((s: SocietyOption) => s.slug === slugParam || s.id === slugParam);
            if (found) {
              setSelectedSociety(found);
              setSocietySearch(found.name);
            }
          }
        } else {
          setSocietyLoadError(true);
        }
      } catch (err) {
        console.error('Failed to load registered societies', err);
        setSocietyLoadError(true);
      } finally {
        setSocietiesLoading(false);
      }
    };
    fetchSocieties();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSocieties = societies.filter((s) => {
    if (!societySearch.trim()) return true;
    const q = societySearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.slug && s.slug.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q))
    );
  });

  const handleSelectSociety = (soc: SocietyOption) => {
    setSelectedSociety(soc);
    setSocietySearch(soc.name);
    setIsDropdownOpen(false);
  };

  const handleClearSociety = () => {
    setSelectedSociety(null);
    setSocietySearch('');
    setIsDropdownOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        // ponytail: Storing credentials in localStorage
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        if (data.data.user.role === 'SUPER_ADMIN') {
          localStorage.setItem('superadmin_token', data.data.accessToken);
          localStorage.setItem('superadmin_user', JSON.stringify(data.data.user));
        }
        onLogin(data.data.accessToken, data.data.user);
      } else {
        setError(data.message || 'Invalid email or password');
      }
    } catch {
      setError('Network error. Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request OTP code via Supabase SMTP
  const handleRequestResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setView('forgot-reset');
        setSuccessMessage(data.message || 'A 6-digit password reset code has been sent to your email.');
      } else {
        setError(data.message || 'Failed to send reset code. Please try again.');
      }
    } catch {
      setError('Network error. Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP code & set new password
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    const cleanCode = resetCode.trim();
    const cleanNewPassword = newPassword.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the 6-digit reset code received on your email.');
      return;
    }
    if (cleanNewPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (cleanNewPassword !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
          password: cleanNewPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmail(cleanEmail);
        setPassword('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
        setView('login');
        setSuccessMessage('Password successfully reset! Please sign in with your new password.');
      } else {
        setError(data.message || 'Failed to reset password. Please check your code and try again.');
      }
    } catch {
      setError('Network error. Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-container">
      <div className="login-bg-photo" />
      <div className="login-bg-grid" />
      <div className="login-glow-orb a" />
      <div className="login-glow-orb b" />
      <div className="login-card-container">
        
        {/* Left Side - Branding / Graphic */}
        <div className="login-left-side">
          {/* Ambient Glows */}
          <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '350px', height: '350px', background: 'var(--primary)', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.15 }} />
          <div style={{ position: 'absolute', bottom: '-20%', left: '-20%', width: '400px', height: '400px', background: 'var(--primary)', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.1 }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 60 }}>
              <div style={{ background: 'var(--primary)', padding: 10, borderRadius: 12, boxShadow: '0 4px 12px rgba(0, 200, 150, 0.3)' }}>
                <Icon name="shield-check" size={28} color="white" />
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.5px' }}>SecureGate</span>
            </div>
            
            <h1 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em' }}>
              Intelligent<br/>Community<br/>Security.
            </h1>
            <p style={{ color: 'var(--text-sidebar)', fontSize: 16, lineHeight: 1.6, maxWidth: 320 }}>
              The all-in-one portal to effortlessly manage workforce, entry passes, and your residents.
            </p>
          </div>
          
          <div style={{ position: 'relative', zIndex: 1, fontSize: 13, color: 'var(--text-sidebar)', fontWeight: 500 }}>
            © {new Date().getFullYear()} SecureGate Inc.
          </div>
        </div>

        {/* Right Side - Forms */}
        <div className="login-right-side">
          {/* VIEW: LOGIN */}
          {view === 'login' && (
            <>
              <h2 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Welcome Back
              </h2>
              <p style={{ margin: '0 0 28px 0', color: 'var(--text-muted)', fontSize: 15 }}>
                Please enter your manager or super admin credentials to sign in.
              </p>

              {successMessage && (
                <div style={{
                  padding: '12px 16px',
                  marginBottom: 20,
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  border: '1px solid #A7F3D0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Icon name="check" size={16} color="#047857" />
                  {successMessage}
                </div>
              )}

              {error && (
                <div style={{ 
                  padding: '12px 16px', 
                  marginBottom: 20,
                  backgroundColor: '#FEF2F2', 
                  color: 'var(--danger)', 
                  borderRadius: 8,
                  fontSize: 14, 
                  fontWeight: 500,
                  border: '1px solid #FECACA'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                {/* API unreachable warning */}
                {societyLoadError && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#FFF7ED',
                    border: '1px solid #FED7AA',
                    color: '#C2410C',
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    ⚠️ Could not reach the server. Make sure the API is running on port 5000.
                  </div>
                )}

                {/* Choose Society Autocomplete Dropdown */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                      Choose Society
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Optional for Super Admin</span>
                  </div>
                  
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 14, color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <Icon name="building" size={17} color={selectedSociety ? 'var(--primary)' : 'var(--text-muted)'} />
                    </div>
                    
                    <input
                      type="text"
                      value={societySearch}
                      onChange={(e) => {
                        setSocietySearch(e.target.value);
                        if (selectedSociety && e.target.value !== selectedSociety.name) {
                          setSelectedSociety(null);
                        }
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder="Search or choose your society..."
                      className="form-input"
                      style={{
                        padding: '14px 40px 14px 42px',
                        fontSize: 14,
                        borderRadius: 10,
                        background: '#F8FAFC',
                        width: '100%',
                        borderColor: selectedSociety ? 'var(--primary)' : undefined,
                      }}
                    />

                    <div style={{ position: 'absolute', right: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {societySearch && (
                        <button
                          type="button"
                          onClick={handleClearSociety}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                      >
                        <Icon name="chevron-down" size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Filtered Dropdown Menu */}
                  {isDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      maxHeight: '230px',
                      overflowY: 'auto',
                      background: '#FFFFFF',
                      borderRadius: 10,
                      border: '1px solid var(--border, #E2E8F0)',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
                      zIndex: 50,
                      padding: '6px',
                    }}>
                      {societiesLoading ? (
                        <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                          Loading societies...
                        </div>
                      ) : filteredSocieties.length > 0 ? (
                        filteredSocieties.map((soc) => {
                          const isSelected = selectedSociety?.id === soc.id;
                          return (
                            <div
                              key={soc.id}
                              onClick={() => handleSelectSociety(soc)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 8,
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: isSelected ? 'rgba(0, 200, 150, 0.08)' : 'transparent',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 14, fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                                  {soc.name}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {soc.city || 'India'} {soc.slug ? `• /${soc.slug}` : ''}
                                </div>
                              </div>
                              {isSelected && (
                                <div style={{ color: 'var(--primary)' }}>
                                  <Icon name="check" size={16} />
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                          {societySearch
                            ? `No societies found matching "${societySearch}"`
                            : 'No registered societies found.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@example.com"
                    className="form-input" 
                    style={{ padding: '14px 16px', fontSize: 14, borderRadius: 10, background: '#F8FAFC' }}
                    required
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setSuccessMessage('');
                        setResetEmail(email.trim());
                        setView('forgot-request');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="form-input"
                    style={{ padding: '14px 16px', fontSize: 14, letterSpacing: '0.1em', borderRadius: 10, background: '#F8FAFC' }}
                    required
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ 
                    background: 'var(--primary)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '14px', 
                    borderRadius: 10, 
                    fontWeight: 600, 
                    fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: 8, 
                    marginTop: 8,
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0, 200, 150, 0.25)',
                    opacity: loading ? 0.7 : 1
                  }}
                  onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {loading ? 'Processing...' : 'Sign In to Portal'} 
                  {!loading && <Icon name="arrow-right" size={18} />}
                </button>
              </form>
            </>
          )}

          {/* VIEW: FORGOT PASSWORD - STEP 1 (REQUEST OTP) */}
          {view === 'forgot-request' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMessage('');
                  setView('login');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                <Icon name="arrow-left" size={16} />
                Back to Sign In
              </button>

              <h2 style={{ margin: '0 0 8px 0', fontSize: 26, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Reset Password
              </h2>
              <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>
                Enter your registered email address. We will send a 6-digit verification code to your inbox.
              </p>

              {error && (
                <div style={{ 
                  padding: '12px 16px', 
                  marginBottom: 20,
                  backgroundColor: '#FEF2F2', 
                  color: 'var(--danger)', 
                  borderRadius: 8,
                  fontSize: 14, 
                  fontWeight: 500,
                  border: '1px solid #FECACA'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleRequestResetOtp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                    Registered Email Address
                  </label>
                  <input 
                    type="email" 
                    value={resetEmail} 
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="manager@example.com"
                    className="form-input" 
                    style={{ padding: '14px 16px', fontSize: 14, borderRadius: 10, background: '#F8FAFC' }}
                    required
                    autoFocus
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ 
                    background: 'var(--primary)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '14px', 
                    borderRadius: 10, 
                    fontWeight: 600, 
                    fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: 8, 
                    marginTop: 8,
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0, 200, 150, 0.25)',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Sending Code...' : 'Send Reset Code'} 
                  {!loading && <Icon name="mail" size={18} />}
                </button>
              </form>
            </>
          )}

          {/* VIEW: FORGOT PASSWORD - STEP 2 (ENTER CODE & NEW PASSWORD) */}
          {view === 'forgot-reset' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMessage('');
                  setView('forgot-request');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                <Icon name="arrow-left" size={16} />
                Change Email
              </button>

              <h2 style={{ margin: '0 0 8px 0', fontSize: 26, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Set New Password
              </h2>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>
                Enter the 6-digit code sent to <strong style={{ color: 'var(--text-main)' }}>{resetEmail}</strong> and enter your new password.
              </p>

              {successMessage && (
                <div style={{
                  padding: '12px 16px',
                  marginBottom: 18,
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid #A7F3D0',
                }}>
                  {successMessage}
                </div>
              )}

              {error && (
                <div style={{ 
                  padding: '12px 16px', 
                  marginBottom: 18,
                  backgroundColor: '#FEF2F2', 
                  color: 'var(--danger)', 
                  borderRadius: 8,
                  fontSize: 14, 
                  fontWeight: 500,
                  border: '1px solid #FECACA'
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleConfirmResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                    6-Digit Reset Code
                  </label>
                  <input 
                    type="text" 
                    value={resetCode} 
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="form-input" 
                    style={{
                      padding: '12px 16px',
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: '0.3em',
                      borderRadius: 10,
                      background: '#F8FAFC',
                      textAlign: 'center',
                    }}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                    New Password
                  </label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="form-input"
                    style={{ padding: '12px 16px', fontSize: 14, letterSpacing: '0.1em', borderRadius: 10, background: '#F8FAFC' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                    Confirm New Password
                  </label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="form-input"
                    style={{ padding: '12px 16px', fontSize: 14, letterSpacing: '0.1em', borderRadius: 10, background: '#F8FAFC' }}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ 
                    background: 'var(--primary)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '14px', 
                    borderRadius: 10, 
                    fontWeight: 600, 
                    fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: 8, 
                    marginTop: 6,
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0, 200, 150, 0.25)',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'} 
                  {!loading && <Icon name="lock" size={18} />}
                </button>

                <div style={{ textAlign: 'center', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => handleRequestResetOtp()}
                    disabled={loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Didn't receive a code?{' '}
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Resend Code</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
