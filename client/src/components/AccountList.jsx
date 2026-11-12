import React, { useEffect, useState } from 'react';
import { fetchAccounts, createAccount, fetchBalance, fetchStatement, getErrorMessage } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { CURRENCIES } from '../constants/currencies';

const fmt = (cents, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100);

export default function AccountList({ onSelect, refresh }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [form,     setForm]     = useState({ account_name: '', account_type: 'ASSET', currency: 'USD' });
  const [error,    setError]    = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [statementAccount, setStatementAccount] = useState(null);
  const [statement, setStatement] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAccounts();
      setAccounts(data);
      const bals = {};
      const results = await Promise.all(data.map(async (account) => {
        const balance = await fetchBalance(account.id);
        return [account.id, balance.balance_cents];
      }));
      results.forEach(([id, balance]) => { bals[id] = balance; });
      setBalances(bals);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load accounts and balances. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refresh]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createAccount(form);
      setForm({ account_name: '', account_type: 'ASSET', currency: 'USD' });
      setShowForm(false);
      await load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to create account'); }
    finally { setSaving(false); }
  };

  const openStatement = async (account) => {
    setStatementAccount(account);
    setStatement(null);
    setStatementError('');
    setStatementLoading(true);
    try {
      setStatement(await fetchStatement(account.id));
    } catch (err) {
      setStatementError(getErrorMessage(err));
    } finally {
      setStatementLoading(false);
    }
  };

  const totalsByCurrency = accounts.reduce((totals, account) => {
    totals[account.currency] = (totals[account.currency] || 0) + (balances[account.id] || 0);
    return totals;
  }, {});
  const currencies = [...new Set(accounts.map((account) => account.currency))].length;

  return (
    <section>
      <div className="dashboard-intro">
        <div>
          <h1 className="page-heading">Good to see you, {user?.name || 'there'}</h1>
          <p className="page-subtitle">A clear view of your accounts and balances.</p>
        </div>
        {['ADMIN', 'ACCOUNT_HOLDER'].includes(user?.role) && (
          <button className="button button-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New account'}
          </button>
        )}
      </div>

      <div className="summary-grid">
        <div className="panel summary-card">
          <div className="summary-label">Accounts</div>
          <div className="summary-value">{loading ? '—' : accounts.length}</div>
          <div className="summary-caption">Accounts visible in your workspace</div>
        </div>
        <div className="panel summary-card">
          <div className="summary-label">Currencies</div>
          <div className="summary-value">{loading ? '—' : currencies}</div>
          <div className="summary-caption">Balances stay grouped by currency</div>
        </div>
        <div className="panel summary-card">
          <div className="summary-label">Portfolio balances</div>
          {loading ? <div className="summary-value">—</div> : accounts.length === 0 ? (
            <div className="summary-value">—</div>
          ) : (
            <div className="currency-totals">
              {Object.entries(totalsByCurrency).map(([currency, total]) => (
                <span className="currency-total" key={currency}>{fmt(total, currency)}</span>
              ))}
            </div>
          )}
          <div className="summary-caption">Shown separately to avoid mixing currencies</div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="inline-form">
          <input className="field" placeholder="Account name (e.g. Main Checking)"
            value={form.account_name}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            required maxLength={120} aria-label="Account name" />
          <select value={form.account_type}
            onChange={(e) => setForm({ ...form, account_type: e.target.value })}
            className="select-field" aria-label="Account type">
            {['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="select-field" aria-label="Account currency">
            {CURRENCIES.map(({ code, name }) => <option key={code} value={code}>{code} — {name}</option>)}
          </select>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}

      {error && <p role="alert" className="form-error">{error}</p>}

      <div className="account-section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Your accounts</h2>
            <p className="section-description">Choose an account to start a deposit, withdrawal, or transfer.</p>
          </div>
        </div>
        {loading ? <div className="panel loading-state">Loading your accounts…</div> : accounts.length > 0 ? (
          <div className="account-grid">
            {accounts.map((account) => (
              <article key={account.id} className="panel account-card">
                <div className="account-card-top">
                  <span className="account-name">{account.account_name}</span>
                  <span className="account-type" style={{ background: typeColor(account.account_type) }}>
                    {account.account_type}
                  </span>
                </div>
                <div className="account-balance">{fmt(balances[account.id], account.currency)}</div>
                <div className="account-meta">{account.currency} balance</div>
                <div className="account-actions">
                  <span className="account-date">Opened {new Date(account.created_at).toLocaleDateString()}</span>
                  <div className="account-buttons">
                    <button className="text-button" onClick={() => openStatement(account)}>Statement</button>
                    <button className="text-button" onClick={() => onSelect?.(account)}>Manage →</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel empty-state">
            No accounts yet. Create an account to start managing your money.
          </div>
        )}
        {statementAccount && (
          <section className="panel statement-panel" aria-live="polite">
            <div className="section-heading">
              <div>
                <h2 className="section-title">{statementAccount.account_name} statement</h2>
                <p className="section-description">
                  Ledger activity for this account · Current balance {fmt(balances[statementAccount.id], statementAccount.currency)}
                </p>
              </div>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setStatementAccount(null);
                  setStatement(null);
                  setStatementError('');
                }}
              >
                Close
              </button>
            </div>
            {statementError && <p role="alert" className="form-error">{statementError}</p>}
            {statementLoading ? <div className="loading-state">Loading account statement…</div>
              : statement && statement.entries.length === 0 ? (
                <div className="empty-state">No ledger entries have been posted to this account yet.</div>
              ) : statement && (
                <div className="table-wrap">
                  <table className="entries-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Activity</th>
                        <th>Description</th>
                        <th className="number-cell">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{new Date(entry.tx_created_at).toLocaleString()}</td>
                          <td>{entry.type}</td>
                          <td>{entry.description || 'No description'}</td>
                          <td className={`number-cell ${Number(entry.amount) >= 0 ? 'positive-text' : 'negative-text'}`}>
                            {fmt(entry.amount, statement.account.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </section>
        )}
      </div>
    </section>
  );
}

const typeColor = (t) => ({
  ASSET: '#16a34a', LIABILITY: '#dc2626', EQUITY: '#7c3aed',
  INCOME: '#0891b2', EXPENSE: '#d97706',
}[t] || '#64748b');
