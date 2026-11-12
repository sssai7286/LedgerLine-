import React, { useEffect, useState } from 'react';
import { deposit, withdraw, transfer, fetchAccounts } from '../api/api';
import { v4 as uuidv4 } from 'uuid';

const TABS = ['Deposit', 'Withdraw', 'Transfer'];

export default function LedgerOperations({ onDone }) {
  const [tab,      setTab]      = useState('Deposit');
  const [accounts, setAccounts] = useState([]);
  const [form,     setForm]     = useState({});
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [busy,     setBusy]     = useState(false);

  useEffect(() => {
    fetchAccounts().then(setAccounts).catch(() => {});
    setForm({});
    setError('');
    setSuccess('');
  }, [tab]);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);

    // Parse amount to integer cents
    const amount_cents = Math.round(parseFloat(form.amount || 0) * 100);
    if (!amount_cents || amount_cents <= 0) {
      setError('Enter a valid positive amount');
      setBusy(false);
      return;
    }

    const idempotency_key = `${tab.toLowerCase()}-${uuidv4()}`;

    try {
      if (tab === 'Deposit') {
        await deposit({ ...form, amount_cents, idempotency_key });
        setSuccess(`Deposited ${form.amount} ${form.currency || 'USD'} successfully`);
      } else if (tab === 'Withdraw') {
        await withdraw({ ...form, amount_cents, idempotency_key });
        setSuccess(`Withdrew ${form.amount} ${form.currency || 'USD'} successfully`);
      } else {
        await transfer({ ...form, amount_cents, idempotency_key });
        setSuccess(`Transferred ${form.amount} ${form.currency || 'USD'} successfully`);
      }
      setForm({});
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const f = (k, placeholder, type = 'text', opts = null) => (
    opts
      ? <select key={k} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          required style={s.input} aria-label={placeholder}>
          <option value="">— {placeholder} —</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.account_name} ({o.currency})</option>)}
        </select>
      : <input key={k} type={type} placeholder={placeholder} value={form[k] || ''}
          onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          required={k !== 'description'} style={s.input} aria-label={placeholder} />
  );

  return (
    <section style={s.section}>
      <h2 style={s.title}>Money Operations</h2>

      <div style={s.tabs}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}>{t}</button>
        ))}
      </div>

      <form onSubmit={handle} style={s.form}>
        {tab === 'Deposit'  && f('account_id', 'Select account', 'text', accounts)}
        {tab === 'Withdraw' && f('account_id', 'Select account', 'text', accounts)}
        {tab === 'Transfer' && (
          <>
            {f('from_account_id', 'From account', 'text', accounts)}
            {f('to_account_id',   'To account',   'text', accounts)}
          </>
        )}
        {f('amount',      'Amount (e.g. 10.00)',   'number')}
        {f('currency',    'Currency (USD)',         'text')}
        {f('description', 'Description (optional)')}

        {error   && <p role="alert"  style={s.err}>{error}</p>}
        {success && <p role="status" style={s.ok}>{success}</p>}

        <button type="submit" disabled={busy} style={s.btn}>
          {busy ? 'Processing…' : tab}
        </button>
      </form>
    </section>
  );
}

const s = {
  section:   { marginBottom: 40 },
  title:     { color: '#1e293b', marginBottom: 16 },
  tabs:      { display: 'flex', gap: 8, marginBottom: 20 },
  tab:       { padding: '8px 20px', borderRadius: 20, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#475569' },
  tabActive: { background: '#2563eb', border: '1px solid #2563eb', color: '#fff', fontWeight: 600 },
  form:      { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 },
  input:     { padding: '10px 14px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' },
  btn:       { padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15, fontWeight: 600 },
  err:       { color: '#dc2626', fontSize: 13, margin: 0 },
  ok:        { color: '#16a34a', fontSize: 13, margin: 0 },
};
