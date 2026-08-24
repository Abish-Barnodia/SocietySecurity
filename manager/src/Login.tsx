import React, { useState } from 'react';
import Icon from './Icon';
import PasswordInput from './PasswordInput';
import { API_BASE } from './config';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const endpoint = isLogin ? '/auth/login' : '/auth/signup';
    const body = isLogin ? { email, password } : { email, password, name };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (!isLogin) {
          // Switch to login after successful signup
          setIsLogin(true);
          setError('Signup successful! Please login.');
        } else {
          // ponytail: Storing in localStorage directly
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          localStorage.setItem('user', JSON.stringify(data.data.user));
          onLogin(data.data.accessToken, data.data.user);
        }
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error');
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

        {/* Right Side - Form */}
        <div className="login-right-side">
          <h2 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ margin: '0 0 32px 0', color: 'var(--text-muted)', fontSize: 15 }}>
            {isLogin ? 'Please enter your details to sign in.' : 'Get started with your admin account.'}
          </p>

          {error && (
            <div style={{ 
              padding: '12px 16px', 
              marginBottom: 24,
              backgroundColor: error.includes('successful') ? 'var(--primary-bg)' : '#FEF2F2', 
              color: error.includes('successful') ? 'var(--primary-hover)' : 'var(--danger)', 
              borderRadius: 8,
              fontSize: 14, 
              fontWeight: 500,
              border: `1px solid ${error.includes('successful') ? '#A7F3D0' : '#FECACA'}`
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!isLogin && (
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                  Full Name
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Arjun Mehta"
                  className="form-input" 
                  style={{ padding: '14px 16px', fontSize: 15, borderRadius: 10, background: '#F8FAFC' }}
                  required={!isLogin}
                />
              </div>
            )}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                Email Address
              </label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@example.com"
                className="form-input" 
                style={{ padding: '14px 16px', fontSize: 15, borderRadius: 10, background: '#F8FAFC' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                Password
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                style={{ padding: '14px 16px', fontSize: 15, letterSpacing: '0.1em', borderRadius: 10, background: '#F8FAFC' }}
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
                marginTop: 12,
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0, 200, 150, 0.25)',
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In to Portal' : 'Create Account')} 
              {!loading && <Icon name="arrow-right" size={18} />}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                style={{ 
                  background: 'transparent', 
                  color: 'var(--text-muted)', 
                  border: 'none', 
                  fontSize: 14, 
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                {isLogin ? (
                  <>Don't have an account? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign up</span></>
                ) : (
                  <>Already have an account? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</span></>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
