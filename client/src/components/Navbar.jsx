import React from 'react';
import { useAuth } from '../context/AuthContext';

const ROLE_COLOR = { ADMIN: '#7c3aed', ACCOUNT_HOLDER: '#2563eb', AUDITOR: '#0891b2' };

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();

  const tabs = ['Dashboard', 'Operations', 'Transactions'];
  if (['ADMIN', 'AUDITOR'].includes(user?.role)) tabs.push('Audit Log');

  return (
    <nav style={s.nav} role="navigation" aria-label="Main navigation">
      <div style={s.brand}>📒 <span style={s.brandText}>LedgerLine</span></div>

      <div style={s.tabs}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ ...s.tab, ...(activeTab === t ? s.tabActive : {}) }}
            aria-current={activeTab === t ? 'page' : undefined}>
            {t}
          </button>
        ))}
      </div>

      <div style={s.user}>
        <span style={{ ...s.roleBadge, background: ROLE_COLOR[user?.role] }}>
          {user?.role?.replace('_', ' ')}
        </span>
        <span style={s.name}>{user?.name}</span>
        <button onClick={logout} style={s.logoutBtn} aria-label="Sign out">Sign out</button>
      </div>
    </nav>
  );
}

const s = {
  nav:       { display: 'flex', alignItems: 'center', background: '#1e293b', padding: '0 24px', height: 56, gap: 24, flexWrap: 'wrap' },
  brand:     { color: '#f1f5f9', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 },
  brandText: { letterSpacing: '.02em' },
  tabs:      { display: 'flex', gap: 4, flex: 1 },
  tab:       { padding: '6px 14px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: 6, fontSize: 14 },
  tabActive: { background: '#334155', color: '#f1f5f9', fontWeight: 600 },
  user:      { display: 'flex', alignItems: 'center', gap: 10 },
  roleBadge: { color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 },
  name:      { color: '#cbd5e1', fontSize: 13 },
  logoutBtn: { padding: '5px 12px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
};
