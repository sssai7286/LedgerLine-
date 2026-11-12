import React, { useEffect, useState } from 'react';
import { fetchTransactions, fetchTransactionEntries } from '../api/api';

const typeColor = { DEPOSIT: '#16a34a', WITHDRAWAL: '#dc2626', TRANSFER: '#2563eb' };
const fmt = (cents, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

export default function TransactionHistory({ refresh }) {
  const [txns,     setTxns]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [error,    setError]    = useState('');

  useEffect(() => {
    fetchTransactions()
      .then(setTxns)
      .catch(() => setError('Failed to load transactions'));
  }, [refresh]);

  const loadDetail = async (tx) => {
    setDetail(null);
    setSelected(tx.id);
    try {
      const d = await fetchTransactionEntries(tx.id);
      setDetail(d);
    } catch { setError('Failed to load entries'); }
  };

  return (
    <section style={s.section}>
      <h2 style={{ color: '#1e293b', marginBottom: 16 }}>Transaction History</h2>
      {error && <p role="alert" style={{ color: '#dc2626' }}>{error}</p>}

      <div style={s.layout}>
        <div style={s.list}>
          {txns.length === 0 && <p style={{ color: '#94a3b8', fontSize: 14 }}>No transactions yet</p>}
          {txns.map((tx) => (
            <button key={tx.id} onClick={() => loadDetail(tx)}
              style={{ ...s.txBtn, borderColor: selected === tx.id ? '#2563eb' : '#e2e8f0',
                background: selected === tx.id ? '#eff6ff' : '#fff' }}>
              <div style={s.txTop}>
                <span style={{ ...s.typeBadge, background: typeColor[tx.type] }}>{tx.type}</span>
                <span style={s.txAmt}>{fmt(tx.amount_cents, tx.currency)}</span>
              </div>
              <div style={s.txDesc}>{tx.description || '—'}</div>
              <div style={s.txDate}>{new Date(tx.created_at).toLocaleString()}</div>
            </button>
          ))}
        </div>

        <div style={s.detail}>
          {!detail && <p style={{ color: '#94a3b8', fontSize: 14 }}>Select a transaction to view journal entries</p>}
          {detail && (
            <>
              <h3 style={{ margin: '0 0 4px', color: '#1e293b' }}>
                {detail.transaction.description || '(no description)'}
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                ID: <span style={{ fontFamily: 'monospace' }}>{detail.transaction.id}</span>
                &nbsp;·&nbsp;
                By: {detail.transaction.initiated_by_email || 'unknown'}
              </p>

              <table style={s.table}>
                <thead>
                  <tr>
                    {['Account','Type','Amount','Currency'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.entries.map((e) => (
                    <tr key={e.id}>
                      <td style={s.td}>{e.account_name || 'External clearing'}</td>
                      <td style={{ ...s.td, color: e.amount > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {e.amount > 0 ? 'Debit' : 'Credit'}
                      </td>
                      <td style={{ ...s.td, fontFamily: 'monospace', textAlign: 'right' }}>
                        {fmt(Math.abs(Number(e.amount)), e.currency || detail.transaction.currency)}
                      </td>
                      <td style={s.td}>{e.currency || detail.transaction.currency}</td>
                    </tr>
                  ))}
                </tbody>
                {detail.entries.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={2} style={{ ...s.td, fontWeight: 700 }}>Net (must be 0)</td>
                      <td style={{ ...s.td, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700,
                        color: detail.entries.reduce((sum, e) => sum + Number(e.amount), 0) === 0 ? '#16a34a' : '#dc2626' }}>
                        {detail.entries.reduce((sum, e) => sum + Number(e.amount), 0)} cents
                      </td>
                      <td style={s.td}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const s = {
  section: { marginBottom: 40 },
  layout:  { display: 'flex', gap: 20, flexWrap: 'wrap' },
  list:    { display: 'flex', flexDirection: 'column', gap: 8, width: 280, flexShrink: 0 },
  txBtn:   { border: '1px solid', borderRadius: 8, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', width: '100%' },
  txTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  typeBadge: { color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  txAmt:   { fontWeight: 700, fontSize: 15, color: '#1e293b' },
  txDesc:  { fontSize: 13, color: '#475569', marginBottom: 2 },
  txDate:  { fontSize: 11, color: '#94a3b8' },
  detail:  { flex: 1, minWidth: 300, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 20 },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:      { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' },
  td:      { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', color: '#1e293b' },
};
