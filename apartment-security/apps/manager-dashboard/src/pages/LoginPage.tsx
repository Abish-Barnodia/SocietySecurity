import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.message ?? 'Sign-in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.logoIcon}>🛡️</div>
        <h1 style={styles.title}>Manager Portal</h1>
        <p style={styles.subtitle}>SecureGate · sign in with your property manager account</p>

        <label style={styles.label} htmlFor="email">Email Address</label>
        <input
          id="email"
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="manager@demo.com"
          autoComplete="username"
        />

        <label style={styles.label} htmlFor="password">Password</label>
        <input
          id="password"
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={{ ...styles.button, ...((loading || !email || !password) ? styles.buttonDisabled : {}) }} disabled={loading || !email || !password}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    width: 380,
    background: 'var(--card)',
    borderRadius: 18,
    padding: '40px 36px 36px',
    boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 12px 40px -8px rgba(16,24,40,0.10)',
    border: '1px solid var(--border)',
    textAlign: 'center',
  },

  logoIcon: {
    width: 48, height: 48, borderRadius: 13, background: 'var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
    margin: '0 auto 18px',
  },
  title: { fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--text)', letterSpacing: -0.2 },
  subtitle: { fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.5 },

  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 7, marginTop: 18, textAlign: 'left' },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)',
    fontSize: 14, color: 'var(--text)', background: 'var(--bg)', transition: 'border-color 120ms ease',
  },

  error: {
    color: 'var(--danger)', fontSize: 12.5, marginTop: 16, marginBottom: 0,
    background: 'var(--danger-bg)', padding: '9px 11px', borderRadius: 9, lineHeight: 1.4, textAlign: 'left',
  },

  button: {
    width: '100%', marginTop: 26, padding: '13px', borderRadius: 10, border: 'none',
    background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14.5,
    transition: 'opacity 120ms ease',
  },
  buttonDisabled: { opacity: 0.55 },
};
