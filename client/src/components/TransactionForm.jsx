import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createTransaction, fetchAccounts, getErrorMessage } from '../api/api';

const emptyEntry = () => ({ account_id: '', amount: '' });
const emptyForm = () => ({ idempotency_key: `journal-${uuidv4()}`, description: '' });

export default function TransactionForm({ onCreated }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [entries, setEntries] = useState([emptyEntry(), emptyEntry()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const net = entries.reduce((sum, entry) => sum + (entry.amount === '' ? 0 : Number(entry.amount)), 0);
  const hasValidAmounts = entries.every((entry) =>
    Number.isSafeInteger(Number(entry.amount)) && Number(entry.amount) !== 0
  );
  const hasAllAccounts = entries.every((entry) => Boolean(entry.account_id));
  const canSubmit = hasValidAmounts && hasAllAccounts && Number.isSafeInteger(net) && net === 0;
  const selectedCurrency = entries
    .map((entry) => accounts.find((account) => account.id === entry.account_id)?.currency)
    .find(Boolean);

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const updateEntry = (index, field, value) => {
    const account = field === 'account_id' ? accounts.find((item) => item.id === value) : null;
    setEntries((current) => current.map((entry, entryIndex) => {
      if (entryIndex === index) return { ...entry, [field]: value };
      if (index === 0 && account
        && accounts.find((item) => item.id === entry.account_id)?.currency !== account.currency) {
        return { ...entry, account_id: '' };
      }
      return entry;
    }));
    setError('');
    setSuccess('');
  };

  const addEntry = () => setEntries((current) => [...current, emptyEntry()]);
  const removeEntry = (index) => setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!hasAllAccounts || !hasValidAmounts) {
      setError('Choose an account and enter a non-zero whole number of cents for every journal entry.');
      return;
    }
    if (new Set(entries.map((entry) => entry.account_id)).size !== entries.length) {
      setError('Each account can only appear once in a journal transaction.');
      return;
    }
    if (!Number.isSafeInteger(net) || net !== 0) {
      setError(`Journal entries are out of balance by ${net} cents. The net must equal 0.`);
      return;
    }

    setSaving(true);
    try {
      await createTransaction({
        ...form,
        entries: entries.map((entry) => ({
          account_id: entry.account_id,
          amount: Number(entry.amount),
        })),
      });
      setSuccess('Balanced journal transaction posted successfully.');
      setForm(emptyForm());
      setEntries([emptyEntry(), emptyEntry()]);
      onCreated?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const availableAccounts = (entryIndex) => {
    const alreadySelected = new Set(entries
      .filter((_, index) => index !== entryIndex)
      .map((entry) => entry.account_id)
      .filter(Boolean));
    const currentAccountId = entries[entryIndex].account_id;
    return accounts.filter((account) =>
      (!selectedCurrency || account.currency === selectedCurrency)
      && (!alreadySelected.has(account.id) || account.id === currentAccountId)
    );
  };

  return (
    <section className="panel journal-panel">
      <div className="section-heading">
        <div>
          <h2 className="section-title">Journal entry</h2>
          <p className="section-description">Record a balanced multi-account transaction.</p>
        </div>
      </div>

      {error && <p role="alert" className="form-error" style={{ marginBottom: 15 }}>{error}</p>}
      {success && <p role="status" className="form-success" style={{ marginBottom: 15 }}>{success}</p>}
      {loading ? <div className="loading-state">Loading accounts…</div> : accounts.length < 2 ? (
        <div className="empty-state">Create at least two accounts in the same currency to post a journal entry.</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="operation-form" style={{ maxWidth: 'none' }}>
            <label className="form-field">
              <span className="form-label">Idempotency key</span>
              <input
                className="field"
                value={form.idempotency_key}
                onChange={(event) => setForm({ ...form, idempotency_key: event.target.value })}
                maxLength={255}
                required
                aria-label="Idempotency key"
              />
              <span className="form-hint">Keep this key if retrying a request to avoid duplicate postings.</span>
            </label>
            <label className="form-field">
              <span className="form-label">Description <span className="form-hint">(optional)</span></span>
              <input
                className="field"
                placeholder="What is this journal entry for?"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                maxLength={500}
                aria-label="Description"
              />
            </label>
          </div>

          <div style={{ margin: '22px 0 12px' }}>
            <h3 className="section-title" style={{ fontSize: 16 }}>Entries</h3>
            <p className="section-description">
              Enter whole cents. Positive amounts debit; negative amounts credit. All accounts must share a currency.
            </p>
          </div>

          {entries.map((entry, index) => (
            <div className="journal-row" key={index}>
              <select
                className="select-field"
                value={entry.account_id}
                onChange={(event) => updateEntry(index, 'account_id', event.target.value)}
                required
                aria-label={`Entry ${index + 1} account`}
              >
                <option value="">{availableAccounts(index).length ? 'Choose account' : 'No compatible account'}</option>
                {availableAccounts(index).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name} · {account.currency}
                  </option>
                ))}
              </select>
              <input
                className="field"
                type="number"
                step="1"
                placeholder="Amount (cents)"
                value={entry.amount}
                onChange={(event) => updateEntry(index, 'amount', event.target.value)}
                required
                aria-label={`Entry ${index + 1} amount in cents`}
              />
              {entries.length > 2 && (
                <button
                  type="button"
                  className="button button-danger button-small"
                  onClick={() => removeEntry(index)}
                  aria-label={`Remove entry ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <div className="journal-actions">
            <button type="button" className="button button-secondary button-small" onClick={addEntry}>
              + Add entry
            </button>
            <span className={`balance-badge ${canSubmit ? 'balance-good' : 'balance-bad'}`} aria-live="polite">
              {canSubmit ? 'Balanced · 0 cents' : `Net: ${Number.isSafeInteger(net) ? net : 'out of range'} cents`}
            </span>
          </div>

          <button type="submit" className="button button-primary" disabled={!canSubmit || saving}>
            {saving ? 'Posting securely…' : 'Post journal transaction'}
          </button>
        </form>
      )}
    </section>
  );
}
