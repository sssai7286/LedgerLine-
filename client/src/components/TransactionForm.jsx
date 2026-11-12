import React, { useEffect, useState } from 'react';
import { createTransaction, fetchAccounts, getErrorMessage } from '../api/api';

const emptyEntry = () => ({ account_id: '', amount: '' });

export default function TransactionForm({ onCreated }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm]     = useState({ idempotency_key: '', description: '' });
  const [entries, setEntries] = useState([emptyEntry(), emptyEntry()]);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  const net = entries.reduce((sum, entry) => sum + (entry.amount === '' ? 0 : Number(entry.amount)), 0);

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const updateEntry = (i, field, value) => {
    const next = [...entries];
    next[i] = { ...next[i], [field]: value };
    setEntries(next);
  };

  const addEntry = () => setEntries([...entries, emptyEntry()]);
  const removeEntry = (i) => setEntries(entries.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (entries.some((entry) => !Number.isSafeInteger(Number(entry.amount)) || Number(entry.amount) === 0)) {
      setError('Each journal entry must be a non-zero integer amount in cents');
      return;
    }
    if (!Number.isSafeInteger(net) || net !== 0) {
      setError(`Net amount is ${net} cents — must be 0 for a balanced transaction`);
      return;
    }

    try {
      const payload = {
        ...form,
        entries: entries.map((en) => ({
          account_id: en.account_id,
          amount: parseInt(en.amount),
        })),
      };
      await createTransaction(payload);
      setSuccess('Transaction created successfully!');
      setForm({ idempotency_key: '', description: '' });
      setEntries([emptyEntry(), emptyEntry()]);
      if (onCreated) onCreated();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <section style={styles.section}>
      <h2>New Transaction</h2>

      <form onSubmit={handleSubmit}>
        <div style={styles.row}>
          <input
            placeholder="Idempotency key (e.g. inv-001-2026)"
            value={form.idempotency_key}
            onChange={(e) => setForm({ ...form, idempotency_key: e.target.value })}
            required
            style={{ ...styles.input, flex: 2 }}
            aria-label="Idempotency key"
          />
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ ...styles.input, flex: 3 }}
            aria-label="Description"
          />
        </div>

        <h3 style={{ marginBottom: 6 }}>Journal Entries</h3>
        <p style={styles.hint}>
          Enter amounts in <strong>cents</strong> (e.g. $10.00 = 1000).
          Positive = debit, negative = credit. Net must equal <strong>0</strong>.
        </p>

        {entries.map((en, i) => (
          <div key={i} style={styles.row}>
            <select
              value={en.account_id}
              onChange={(e) => updateEntry(i, 'account_id', e.target.value)}
              required
              style={{ ...styles.input, flex: 3 }}
              aria-label={`Entry ${i + 1} account`}
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name} ({account.currency})
                </option>
              ))}
            </select>
            <input
              type="number"
              step="1"
              placeholder="Amount (cents)"
              value={en.amount}
              onChange={(e) => updateEntry(i, 'amount', e.target.value)}
              required
              style={{ ...styles.input, flex: 1 }}
              aria-label={`Entry ${i + 1} amount`}
            />
            {entries.length > 2 && (
              <button
                type="button"
                onClick={() => removeEntry(i)}
                style={styles.removeBtn}
                aria-label={`Remove entry ${i + 1}`}
              >✕</button>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button type="button" onClick={addEntry} style={styles.ghostBtn}>
            + Add Entry
          </button>
          <span style={{ ...styles.netBadge, background: net === 0 ? '#16a34a' : '#dc2626' }}>
            Net: {net} cents {net === 0 ? '✓ Balanced' : '✗ Unbalanced'}
          </span>
        </div>

        <button type="submit" style={styles.btn} disabled={net !== 0}>
          Submit Transaction
        </button>
      </form>

      {error   && <p role="alert" style={styles.error}>{error}</p>}
      {success && <p role="status" style={styles.success}>{success}</p>}
    </section>
  );
}

const styles = {
  section:   { marginBottom: 40 },
  row:       { display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  input:     { padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc' },
  btn:       { padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
  ghostBtn:  { padding: '6px 14px', background: 'transparent', border: '1px solid #2563eb', color: '#2563eb', borderRadius: 4, cursor: 'pointer' },
  removeBtn: { padding: '6px 10px', background: '#fee2e2', border: 'none', color: '#dc2626', borderRadius: 4, cursor: 'pointer' },
  hint:      { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  netBadge:  { color: '#fff', borderRadius: 12, padding: '4px 12px', fontSize: 13 },
  error:     { color: '#dc2626', marginTop: 8 },
  success:   { color: '#16a34a', marginTop: 8 },
};
