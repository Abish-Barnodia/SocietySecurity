import React, { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';

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

  // ponytail: Hardcoded backend URL for simplicity
  const API_BASE = 'http://localhost:5000/api/v1';

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
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-app)', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 400, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--primary)', padding: '12px', borderRadius: '12px', color: 'white', display: 'flex' }}>
            <ShieldCheck size={32} />
          </div>
          <h2 style={{ margin: 0, fontSize: 24 }}>Manager {isLogin ? 'Login' : 'Signup'}</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>SecureGate Admin Portal</p>
        </div>

        {error && (
          <div style={{ color: error.includes('successful') ? 'var(--primary)' : 'var(--danger)', fontSize: 14, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Arjun Mehta"
                className="search-bar" 
                style={{ width: '100%', padding: '10px 12px' }}
                required={!isLogin}
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@example.com"
              className="search-bar" 
              style={{ width: '100%', padding: '10px 12px' }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="search-bar" 
              style={{ width: '100%', padding: '10px 12px' }}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 }}
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')} <ArrowRight size={16} />
          </button>
          
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={{ background: 'transparent', color: 'var(--primary)', border: 'none', fontSize: 13, cursor: 'pointer', marginTop: 8 }}
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
