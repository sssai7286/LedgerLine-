import React, { useEffect, useState } from 'react';
import { fetchAccounts, createAccount, fetchBalance } from '../api/api';

export default function AccountList() {
  const [accounts, setAccounts]   = useState([]);
  const [balances, setBalances]   = useState({});
  const [form, setForm]           = useState({ owner_id: '', currency: 'USD' });
  const [error, setError]         = useState('');

  const loadAccounts = async () => {
    try {
      const data = await fetchAccounts();
      setAccounts(data);
      // Load balances for each account
      const bals = {};
      await Promise.all(
        data.map(async (a) => {
          const b = await fetchBalance(a.id);
          bals[a.id] = b.balance;
        })
      );
      setBalances(bals);
    } catch {
      setError('Failed to load accounts');
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createAccount(form);
      setForm({ owner_id: '', currency: 'USD' });
      loadAccounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    }
  };

  // Format cents → currency string
  const fmt = (cents, currency) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

  return (
    <section style={styles.section}>
      <h2>Accounts</h2>

      <form onSubmit={handleCreate} style={styles.form}>
        <input
          placeholder="Owner ID (UUID)"
          value={form.owner_id}
          onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
          required
          style={styles.input}
          aria-label="Owner ID"
        />
        <input
          placeholder="Currency (USD)"
          value={form.currency}
          maxLength={3}
          onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
          required
          style={styles.input}
          aria-label="Currency"
        />
        <button type="submit" style={styles.btn}>Create Account</button>
      </form>

      {error && <p role="alert" style={styles.error}>{error}</p>}

      <table style={styles.table}>
        <thead>
          <tr>
            <th>ID</th><th>Owner ID</th><th>Currency</th><th>Balance</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td style={styles.mono}>{a.id.slice(0, 8)}…</td>
              <td style={styles.mono}>{a.owner_id.slice(0, 8)}…</td>
              <td>{a.currency}</td>
              <td>{balances[a.id] !== undefined ? fmt(balances[a.id], a.currency) : '—'}</td>
              <td>{new Date(a.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {accounts.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center' }}>No accounts yet</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

const styles = {
  section: { marginBottom: 40 },
  form:    { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  input:   { padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', flex: 1, minWidth: 180 },
  btn:     { padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
  error:   { color: '#dc2626', marginBottom: 8 },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  mono:    { fontFamily: 'monospace' },
};
