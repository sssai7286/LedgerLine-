import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage            from './components/AuthPage';
import Navbar              from './components/Navbar';
import AccountList         from './components/AccountList';
import LedgerOperations    from './components/LedgerOperations';
import TransactionHistory  from './components/TransactionHistory';
import AuditLogViewer      from './components/AuditLogViewer';

function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [refresh,   setRefresh]   = useState(0);

  const bump = () => setRefresh((n) => n + 1);

  return (
    <div style={s.app}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main style={s.main}>
        {activeTab === 'Dashboard' && (
          <AccountList onSelect={() => setActiveTab('Transactions')} />
        )}
        {activeTab === 'Operations' && (
          <LedgerOperations onDone={bump} />
        )}
        {activeTab === 'Transactions' && (
          <TransactionHistory refresh={refresh} />
        )}
        {activeTab === 'Audit Log' && ['ADMIN', 'AUDITOR'].includes(user?.role) && (
          <AuditLogViewer />
        )}
      </main>
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  if (loading) return <div style={s.loading}>Loading…</div>;
  return user ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

const s = {
  app:     { minHeight: '100vh', background: '#f8fafc' },
  main:    { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  loading: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 18 },
};
