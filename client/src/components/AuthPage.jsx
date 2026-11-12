import React, { useState } from 'react';
import { login, register, getErrorMessage } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { storeAuth } = useAuth();
  const [mode,  setMode]  = useState('login'); // 'login' | 'register'
  const [loginType, setLoginType] = useState('user');
  const [form,  setForm]  = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = mode === 'login'
        ? await login({ email: form.email, password: form.password, login_type: loginType })
        : await register(form);
      storeAuth(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.logo}>📒 LedgerLine</h1>
        <p style={s.tagline}>Secure double-entry financial ledger</p>

        <div style={s.tabs}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{ ...s.tab, ...(mode === m ? s.tabActive : {}) }}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {mode === 'login' && (
          <div style={s.loginTypes} role="group" aria-label="Choose login type">
            <button
              type="button"
              onClick={() => { setLoginType('user'); setError(''); }}
              style={{ ...s.loginType, ...(loginType === 'user' ? s.loginTypeActive : {}) }}
              aria-pressed={loginType === 'user'}
            >
              User login
            </button>
            <button
              type="button"
              onClick={() => { setLoginType('admin'); setError(''); }}
              style={{ ...s.loginType, ...(loginType === 'admin' ? s.loginTypeActive : {}) }}
              aria-pressed={loginType === 'admin'}
            >
              Admin login
            </button>
            <button
              type="button"
              onClick={() => { setLoginType('auditor'); setError(''); }}
              style={{ ...s.loginType, ...(loginType === 'auditor' ? s.loginTypeActive : {}) }}
              aria-pressed={loginType === 'auditor'}
            >
              Auditor login
            </button>
            <span style={s.loginHint}>Choose the login type assigned to your account.</span>
          </div>
        )}

        <form onSubmit={handle} style={s.form}>
          {mode === 'register' && (
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={s.input}
              aria-label="Full name"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            style={s.input}
            aria-label="Email"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            style={s.input}
            aria-label="Password"
          />
          {error && <p role="alert" style={s.error}>{error}</p>}

          <button type="submit" disabled={busy} style={s.btn}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page:      { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' },
  card:      { background: '#1e293b', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 400 },
  logo:      { color: '#f1f5f9', margin: 0, fontSize: 28, textAlign: 'center' },
  tagline:   { color: '#94a3b8', textAlign: 'center', margin: '6px 0 24px', fontSize: 14 },
  tabs:      { display: 'flex', marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' },
  tab:       { flex: 1, padding: '10px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 },
  tabActive: { background: '#2563eb', color: '#fff' },
  loginTypes: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7, marginBottom: 18 },
  loginType: { padding: '9px 7px', border: '1px solid #334155', borderRadius: 7, background: '#0f172a', color: '#94a3b8', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  loginTypeActive: { border: '1px solid #3b82f6', background: '#1d4ed8', color: '#fff' },
  loginHint: { gridColumn: '1 / -1', color: '#94a3b8', fontSize: 11 },
  form:      { display: 'flex', flexDirection: 'column', gap: 12 },
  input:     { padding: '10px 14px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 14 },
  btn:       { padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15, fontWeight: 600, marginTop: 4 },
  error:     { color: '#f87171', fontSize: 13, margin: 0 },
};
