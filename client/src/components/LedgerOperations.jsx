import React, { useEffect, useMemo, useState } from 'react';
import { deposit, withdraw, transfer, fetchAccounts, getErrorMessage } from '../api/api';
import { v4 as uuidv4 } from 'uuid';
import { CURRENCIES } from '../constants/currencies';

const TABS = ['Deposit', 'Withdraw', 'Transfer'];
const initialForm = (accountId = '') => ({
  account_id: accountId,
  from_account_id: accountId,
  to_account_id: '',
  amount: '',
  currency: 'USD',
  description: '',
});
const formatMoney = (cents, currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(cents || 0) / 100);

export default function LedgerOperations({ onDone, initialAccountId = '' }) {
  const [tab, setTab] = useState('Deposit');
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(() => initialForm(initialAccountId));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAccounts = async () => {
    try {
      const data = await fetchAccounts();
      setAccounts(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => {
    if (initialAccountId) {
      const account = accounts.find((item) => item.id === initialAccountId);
      setForm((current) => ({
        ...current,
        account_id: initialAccountId,
        from_account_id: initialAccountId,
        currency: account?.currency || current.currency,
      }));
    }
  }, [initialAccountId, accounts]);

  const currencies = useMemo(() => {
    const knownCodes = new Set(CURRENCIES.map(({ code }) => code));
    const additional = accounts
      .map((account) => account.currency)
      .filter((code) => code && !knownCodes.has(code))
      .map((code) => ({ code, name: 'Account currency' }));
    return [...CURRENCIES, ...additional];
  }, [accounts]);

  const activeAccounts = accounts.filter((account) => account.is_active !== false);
  const matchingAccounts = activeAccounts.filter((account) => account.currency === form.currency);
  const sourceId = tab === 'Transfer' ? form.from_account_id : form.account_id;
  const sourceAccount = activeAccounts.find((account) => account.id === sourceId);
  const availableBalance = sourceAccount
    ? formatMoney(sourceAccount.balance_cents, sourceAccount.currency)
    : null;

  const changeCurrency = (currency) => {
    setForm((current) => ({
      ...current,
      currency,
      account_id: '',
      from_account_id: '',
      to_account_id: '',
    }));
    setError('');
    setSuccess('');
  };

  const changeAccount = (field, accountId) => {
    const account = activeAccounts.find((item) => item.id === accountId);
    setForm((current) => ({
      ...current,
      [field]: accountId,
      ...(account ? { currency: account.currency } : {}),
      ...(field === 'from_account_id' ? { to_account_id: '' } : {}),
    }));
    setError('');
    setSuccess('');
  };

  const handle = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const amount = Number(form.amount);
    const amountCents = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountCents)
      || Math.abs(amount * 100 - amountCents) > 0.000001) {
      setError('Enter an amount with up to two decimal places greater than zero.');
      return;
    }
    if (!sourceAccount) {
      setError('Choose an active account to continue.');
      return;
    }
    if (tab === 'Transfer') {
      const destination = activeAccounts.find((account) => account.id === form.to_account_id);
      if (!destination) {
        setError('Choose a destination account to continue.');
        return;
      }
      if (destination.id === sourceAccount.id) {
        setError('Choose a different destination account.');
        return;
      }
      if (destination.currency !== sourceAccount.currency) {
        setError('Transfers are only available between accounts in the same currency.');
        return;
      }
    }

    setBusy(true);
    const payload = {
      ...form,
      amount_cents: amountCents,
      idempotency_key: `${tab.toLowerCase()}-${uuidv4()}`,
    };

    try {
      if (tab === 'Deposit') {
        await deposit(payload);
        setSuccess(`Deposit of ${formatMoney(amountCents, form.currency)} completed.`);
      } else if (tab === 'Withdraw') {
        await withdraw(payload);
        setSuccess(`Withdrawal of ${formatMoney(amountCents, form.currency)} completed.`);
      } else {
        await transfer(payload);
        setSuccess(`Transfer of ${formatMoney(amountCents, form.currency)} completed.`);
      }
      setForm((current) => ({ ...current, amount: '', description: '', to_account_id: '' }));
      await loadAccounts();
      onDone?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const accountSelect = (field, label, value, options, onChange) => (
    <label className="form-field" key={field}>
      <span className="form-label">{label}</span>
      <select
        className="select-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        disabled={loading || options.length === 0}
        aria-label={label}
      >
        <option value="">{loading ? 'Loading accounts…' : 'Choose an account'}</option>
        {options.map((account) => (
          <option key={account.id} value={account.id}>
            {account.account_name} · {formatMoney(account.balance_cents, account.currency)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="panel operations-panel">
      <div className="operations-header">
        <div>
          <h1 className="page-heading">Money operations</h1>
          <p className="page-subtitle">Move money securely between your ledger accounts.</p>
        </div>
        <div className="operation-tabs" role="tablist" aria-label="Money operation type">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={`operation-tab${tab === item ? ' operation-tab-active' : ''}`}
              onClick={() => {
                setTab(item);
                setError('');
                setSuccess('');
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="operation-content">
        {error && <p role="alert" className="form-error" style={{ marginBottom: 15 }}>{error}</p>}
        {success && <p role="status" className="form-success" style={{ marginBottom: 15 }}>{success}</p>}

        {!loading && activeAccounts.length === 0 && (
          <div className="empty-state">
            No active accounts are available. Create an account on the dashboard before making an operation.
          </div>
        )}

        <form className="operation-form" onSubmit={handle}>
          <label className="form-field">
            <span className="form-label">Currency</span>
            <select
              className="select-field"
              value={form.currency}
              onChange={(event) => changeCurrency(event.target.value)}
              aria-label="Currency"
            >
              {currencies.map(({ code, name }) => (
                <option key={code} value={code}>{code} — {name}</option>
              ))}
            </select>
            <span className="form-hint">Only accounts in this currency are shown.</span>
          </label>

          {tab === 'Transfer' ? (
            <>
              {accountSelect('from_account_id', 'From account', form.from_account_id, matchingAccounts,
                (value) => changeAccount('from_account_id', value))}
              {accountSelect('to_account_id', 'To account', form.to_account_id,
                matchingAccounts.filter((account) => account.id !== form.from_account_id),
                (value) => setForm((current) => ({ ...current, to_account_id: value })))}
            </>
          ) : accountSelect(
            'account_id',
            tab === 'Deposit' ? 'Deposit to account' : 'Withdraw from account',
            form.account_id,
            matchingAccounts,
            (value) => changeAccount('account_id', value)
          )}

          <label className="form-field">
            <span className="form-label">Amount</span>
            <div className="amount-wrap">
              <span className="amount-currency">{form.currency}</span>
              <input
                className="field"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                required
                aria-label="Amount"
              />
            </div>
            <span className="form-hint">Enter an amount with up to two decimal places.</span>
          </label>

          <label className="form-field">
            <span className="form-label">Description <span className="form-hint">(optional)</span></span>
            <input
              className="field"
              type="text"
              maxLength={500}
              placeholder="Add a note for this operation"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              aria-label="Description (optional)"
            />
          </label>

          {availableBalance && (
            <div className="account-balance-note field-full">
              Available in {sourceAccount.account_name}: <strong>{availableBalance}</strong>
            </div>
          )}

          <button
            type="submit"
            className="button button-primary operation-submit"
            disabled={busy || loading || activeAccounts.length === 0}
          >
            {busy ? 'Processing securely…' : tab}
          </button>
        </form>
      </div>
    </section>
  );
}
