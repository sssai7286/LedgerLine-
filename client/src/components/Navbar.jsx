import React from 'react';
import { useAuth } from '../context/AuthContext';

const ROLE_COLOR = { ADMIN: '#7c3aed', ACCOUNT_HOLDER: '#2563eb', AUDITOR: '#0891b2' };

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();

  const tabs = ['Dashboard', 'Operations', 'Transactions'];
  if (['ADMIN', 'AUDITOR'].includes(user?.role)) tabs.push('Audit Log');

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="brand"><span className="brand-mark" aria-hidden="true">$</span> LedgerLine</div>

      <div className="nav-tabs">
        {tabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`nav-tab${activeTab === t ? ' nav-tab-active' : ''}`}
            aria-current={activeTab === t ? 'page' : undefined}>
            {t}
          </button>
        ))}
      </div>

      <div className="nav-user">
        <span className="role-badge" style={{ borderColor: `${ROLE_COLOR[user?.role] || '#64748b'}66` }}>
          {user?.role?.replace('_', ' ')}
        </span>
        <span className="user-name">{user?.name}</span>
        <button onClick={logout} className="logout-button" aria-label="Sign out">Sign out</button>
      </div>
    </nav>
  );
}
