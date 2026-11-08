import React, { useEffect, useState } from 'react';
import { fetchAccounts, createAccount, fetchBalance } from '../api/api';
import { useAuth } from '../context/AuthContext';

const fmt = (cents, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100);

export default function AccountList({ onSelect }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [form,     setForm]     = useState({ account_name: '', account_type: 'ASSET', currency: 'USD' });
  const [error,    setError]    = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      const data = await fetchAccounts();
      setAccounts(data);
      const bals = {};
      await Promise.all(data.map(async (a) => {
        const b = await fetchBalance(a._id);
        bals[a._id] = b.balance_cents;
      }));
      setBalances(bals);
    } catch { setError('Failed to load accounts'); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createAccount(form);
      setForm({ account_name: '', account_type: 'ASSET', currency: 'USD' });
      setShowForm(false);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to create account'); }
  };

  return (
    <section style={s.section}>
      <div style={s.header}>
        <h2 style={s.title}>Accounts</h2>
        {['ADMIN', 'ACCOUNT_HOLDER'].includes(user?.role) && (
          <button style={s.btnSm} onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ New Account'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={s.form}>
          <input placeholder="Account name (e.g. Main Checking)"
            value={form.account_name}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            required style={s.input} aria-label="Account name" />
          <select value={form.account_type}
            onChange={(e) => setForm({ ...form, account_type: e.target.value })}
            style={s.input} aria-label="Account type">
            {['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input placeholder="Currency (USD)" value={form.currency} maxLength={3}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            required style={{ ...s.input, width: 100 }} aria-label="Currency" />
          <button type="submit" style={s.btnPrimary}>Create</button>
        </form>
      )}

      {error && <p role="alert" style={s.err}>{error}</p>}

      <div style={s.grid}>
        {accounts.map((a) => (
          <div key={a._id} style={s.card} onClick={() => onSelect?.(a)} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect?.(a)}>
            <div style={s.cardTop}>
              <span style={s.acctName}>{a.account_name}</span>
              <span style={{ ...s.badge, background: typeColor(a.account_type) }}>{a.account_type}</span>
            </div>
            <div style={s.balance}>{fmt(balances[a._id], a.currency)}</div>
            <div style={s.sub}>{a.currency} · {new Date(a.created_at).toLocaleDateString()}</div>
          </div>
        ))}
        {accounts.length === 0 && <p style={s.empty}>No accounts yet</p>}
      </div>
    </section>
  );
}

const typeColor = (t) => ({
  ASSET: '#16a34a', LIABILITY: '#dc2626', EQUITY: '#7c3aed',
  INCOME: '#0891b2', EXPENSE: '#d97706',
}[t] || '#64748b');

const s = {
  section:    { marginBottom: 40 },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:      { margin: 0, color: '#1e293b' },
  form:       { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' },
  input:      { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, flex: 1, minWidth: 140 },
  btnPrimary: { padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  btnSm:      { padding: '6px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  card:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', cursor: 'pointer', transition: 'box-shadow .15s' },
  cardTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  acctName:   { fontWeight: 600, fontSize: 15, color: '#1e293b' },
  badge:      { color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  balance:    { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 4 },
  sub:        { fontSize: 12, color: '#94a3b8' },
  err:        { color: '#dc2626', fontSize: 13 },
  empty:      { color: '#94a3b8', fontSize: 14 },
};
