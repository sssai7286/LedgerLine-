import React, { useEffect, useState } from 'react';
import { fetchTransactions, fetchTransactionEntries } from '../api/api';

export default function JournalEntries({ refresh }) {
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [detail, setDetail]             = useState(null);
  const [error, setError]               = useState('');

  useEffect(() => {
    fetchTransactions()
      .then(setTransactions)
      .catch(() => setError('Failed to load transactions'));
  }, [refresh]);

  const loadDetail = async (id) => {
    setDetail(null);
    setSelected(id);
    try {
      const data = await fetchTransactionEntries(id);
      setDetail(data);
    } catch {
      setError('Failed to load entries');
    }
  };

  const fmt = (cents, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

  return (
    <section>
      <h2>Transactions &amp; Journal Entries</h2>
      {error && <p role="alert" style={{ color: '#dc2626' }}>{error}</p>}

      <div style={styles.layout}>
        {/* Transaction list */}
        <div style={styles.txList}>
          {transactions.length === 0 && <p style={{ color: '#6b7280' }}>No transactions yet</p>}
          {transactions.map((tx) => (
            <button
              key={tx.id}
              onClick={() => loadDetail(tx.id)}
              style={{
                ...styles.txItem,
                background: selected === tx.id ? '#eff6ff' : '#fff',
                borderColor: selected === tx.id ? '#2563eb' : '#e5e7eb',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{tx.description || '(no description)'}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
                {tx.idempotency_key}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {new Date(tx.created_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {/* Entry detail */}
        <div style={styles.detail}>
          {!detail && <p style={{ color: '#9ca3af' }}>Select a transaction to view its journal entries</p>}
          {detail && (
            <>
              <h3 style={{ marginBottom: 4 }}>{detail.transaction.description || '(no description)'}</h3>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                ID: <span style={{ fontFamily: 'monospace' }}>{detail.transaction.id}</span>
              </p>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Account ID</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.entries.map((e) => (
                    <tr key={e.id}>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>
                        {e.account_id.slice(0, 12)}…
                      </td>
                      <td style={{ ...styles.td, color: e.amount > 0 ? '#16a34a' : '#dc2626' }}>
                        {e.amount > 0 ? 'Debit' : 'Credit'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmt(Math.abs(e.amount), e.currency)}
                      </td>
                      <td style={styles.td}>{e.currency}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ ...styles.td, fontWeight: 700 }}>Net (must be 0)</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>
                      {detail.entries.reduce((s, e) => s + Number(e.amount), 0)} cents
                    </td>
                    <td style={styles.td}></td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const styles = {
  layout:  { display: 'flex', gap: 20, flexWrap: 'wrap' },
  txList:  { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, maxWidth: 300 },
  txItem:  { border: '1px solid', borderRadius: 6, padding: '8px 12px', textAlign: 'left', cursor: 'pointer', width: '100%' },
  detail:  { flex: 1, minWidth: 300 },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:      { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' },
  td:      { padding: '6px 8px', borderBottom: '1px solid #f3f4f6' },
};
