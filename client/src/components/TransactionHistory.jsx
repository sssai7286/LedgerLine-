import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchTransactions, fetchTransactionEntries, getErrorMessage } from '../api/api';

const TYPE_STYLES = {
  DEPOSIT: { background: '#eaf8ef', color: '#18834d', label: 'Deposit' },
  WITHDRAWAL: { background: '#fff0f0', color: '#bd4646', label: 'Withdrawal' },
  TRANSFER: { background: '#eef4ff', color: '#315fbd', label: 'Transfer' },
};
const fmt = (cents, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(cents || 0) / 100);
const dateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
};

export default function TransactionHistory({ refresh }) {
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const requestId = useRef(0);

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTransactions(); }, [refresh]);

  const filteredTransactions = useMemo(() => {
    const search = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesType = typeFilter === 'ALL' || transaction.type === typeFilter;
      const searchable = [
        transaction.description,
        transaction.id,
        transaction.initiated_by_email,
        transaction.initiated_by_name,
        transaction.type,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesType && (!search || searchable.includes(search));
    });
  }, [transactions, query, typeFilter]);

  const loadDetail = async (transaction) => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setSelected(transaction.id);
    setDetail(null);
    setError('');
    setDetailLoading(true);
    try {
      const data = await fetchTransactionEntries(transaction.id);
      if (requestId.current === currentRequest) setDetail(data);
    } catch (err) {
      if (requestId.current === currentRequest) setError(getErrorMessage(err));
    } finally {
      if (requestId.current === currentRequest) setDetailLoading(false);
    }
  };

  const net = detail?.entries.reduce((sum, entry) => sum + Number(entry.amount), 0);

  return (
    <section className="panel transactions-panel">
      <div className="section-heading">
        <div>
          <h1 className="page-heading">Transactions</h1>
          <p className="page-subtitle">Search activity and inspect the balanced journal entries behind each posting.</p>
        </div>
        <button type="button" className="button button-secondary" onClick={loadTransactions} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="transactions-toolbar">
        <input
          className="field"
          type="search"
          placeholder="Search description, account holder, or ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search transactions"
        />
        <select
          className="select-field"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label="Filter by transaction type"
        >
          <option value="ALL">All transaction types</option>
          <option value="DEPOSIT">Deposits</option>
          <option value="WITHDRAWAL">Withdrawals</option>
          <option value="TRANSFER">Transfers & journals</option>
        </select>
        <span className="form-hint" aria-live="polite">
          {filteredTransactions.length} of {transactions.length} transactions
        </span>
      </div>

      {error && <p role="alert" className="form-error" style={{ marginBottom: 15 }}>{error}</p>}

      {loading ? <div className="loading-state">Loading transaction history…</div> : (
        <div className="transaction-layout">
          <div className="transaction-list" aria-label="Transaction results">
            {filteredTransactions.map((transaction) => {
              const style = TYPE_STYLES[transaction.type] || TYPE_STYLES.TRANSFER;
              return (
                <button
                  type="button"
                  key={transaction.id}
                  className={`transaction-card${selected === transaction.id ? ' transaction-card-selected' : ''}`}
                  onClick={() => loadDetail(transaction)}
                  aria-pressed={selected === transaction.id}
                >
                  <div className="transaction-topline">
                    <span className="transaction-badge" style={{ background: style.background, color: style.color }}>
                      {style.label}
                    </span>
                    <span className="transaction-amount">{fmt(transaction.amount_cents, transaction.currency)}</span>
                  </div>
                  <div className="transaction-description">{transaction.description || 'No description'}</div>
                  <div className="transaction-date">{dateTime(transaction.created_at)}</div>
                </button>
              );
            })}
            {filteredTransactions.length === 0 && (
              <div className="empty-state">
                {transactions.length === 0
                  ? 'No transactions yet. Completed deposits, withdrawals, and transfers will appear here.'
                  : 'No transactions match your search. Try another term or transaction type.'}
              </div>
            )}
          </div>

          <div className="panel transaction-detail" aria-live="polite">
            {!selected && (
              <div className="empty-state">
                Select a transaction to review its journal entries and audit details.
              </div>
            )}
            {detailLoading && <div className="loading-state">Loading journal entries…</div>}
            {detail && (
              <>
                <h2 className="detail-title">{detail.transaction.description || 'Journal transaction'}</h2>
                <div className="detail-meta">
                  <span>{dateTime(detail.transaction.created_at)}</span>
                  <span>By {detail.transaction.initiated_by_name || detail.transaction.initiated_by_email || 'Unknown'}</span>
                  <code title={detail.transaction.id}>ID {detail.transaction.id}</code>
                </div>
                <div className="table-wrap">
                  <table className="entries-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Entry</th>
                        <th className="number-cell">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.account_name || 'External clearing'}</td>
                          <td className={Number(entry.amount) > 0 ? 'positive-text' : 'negative-text'}>
                            {Number(entry.amount) > 0 ? 'Debit' : 'Credit'}
                          </td>
                          <td className="number-cell">
                            {fmt(Math.abs(Number(entry.amount)), entry.currency || detail.transaction.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {detail.entries.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={2}>Net ledger impact</td>
                          <td className={`number-cell ${net === 0 ? 'positive-text' : 'negative-text'}`}>
                            {Number.isSafeInteger(net) ? `${net} cents` : 'Out of range'}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
