import React, { useEffect, useState } from 'react';
import { fetchAuditLogs } from '../api/api';

const statusColor = { SUCCESS: '#16a34a', FAILURE: '#dc2626' };
const actionColor = {
  AUTH_LOGIN: '#0891b2', AUTH_REGISTER: '#7c3aed', AUTH_LOGOUT: '#94a3b8',
  DEPOSIT: '#16a34a', WITHDRAWAL: '#dc2626', TRANSFER: '#2563eb',
  ACCOUNT_CREATE: '#d97706', TX_CREATE: '#475569',
};

export default function AuditLogViewer() {
  const [logs,   setLogs]   = useState([]);
  const [total,  setTotal]  = useState(0);
  const [page,   setPage]   = useState(1);
  const [filter, setFilter] = useState({ action: '', status: '' });
  const [error,  setError]  = useState('');

  const LIMIT = 20;

  const load = async () => {
    try {
      const params = { page, limit: LIMIT };
      if (filter.action) params.action = filter.action;
      if (filter.status) params.status = filter.status;
      const data = await fetchAuditLogs(params);
      setLogs(data.logs);
      setTotal(data.total);
    } catch { setError('Failed to load audit logs'); }
  };

  useEffect(() => { load(); }, [page, filter]);

  const pages = Math.ceil(total / LIMIT);

  return (
    <section style={s.section}>
      <h2 style={{ color: '#1e293b', marginBottom: 16 }}>Audit Trail</h2>
      {error && <p role="alert" style={{ color: '#dc2626' }}>{error}</p>}

      <div style={s.filters}>
        <select value={filter.action} onChange={(e) => { setFilter({ ...filter, action: e.target.value }); setPage(1); }}
          style={s.sel} aria-label="Filter by action">
          <option value="">All actions</option>
          {['AUTH_LOGIN','AUTH_REGISTER','DEPOSIT','WITHDRAWAL','TRANSFER','ACCOUNT_CREATE'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={filter.status} onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}
          style={s.sel} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
        </select>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>{total} total entries</span>
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Time','User','Role','Action','Resource','Status','IP'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l._id} style={{ background: l.status === 'FAILURE' ? '#fff1f2' : 'transparent' }}>
                <td style={s.td}>{new Date(l.created_at).toLocaleString()}</td>
                <td style={{ ...s.td, fontSize: 12 }}>{l.user_email || '—'}</td>
                <td style={s.td}><span style={s.badge}>{l.role || '—'}</span></td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: actionColor[l.action] || '#64748b', color: '#fff' }}>
                    {l.action}
                  </span>
                </td>
                <td style={s.td}>{l.resource || '—'}</td>
                <td style={s.td}>
                  <span style={{ color: statusColor[l.status], fontWeight: 600, fontSize: 12 }}>
                    {l.status}
                  </span>
                </td>
                <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12 }}>{l.ip || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No entries</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={s.pagination}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={s.pgBtn}>‹ Prev</button>
          <span style={{ color: '#475569', fontSize: 13 }}>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={s.pgBtn}>Next ›</button>
        </div>
      )}
    </section>
  );
}

const s = {
  section:   { marginBottom: 40 },
  filters:   { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  sel:       { padding: '7px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' },
  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { padding: '10px 12px', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' },
  td:        { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#1e293b', whiteSpace: 'nowrap' },
  badge:     { background: '#e2e8f0', color: '#475569', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  pagination:{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  pgBtn:     { padding: '6px 16px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
};
