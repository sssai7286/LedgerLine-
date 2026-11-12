import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage            from './components/AuthPage';
import Navbar              from './components/Navbar';
import AccountList         from './components/AccountList';
import LedgerOperations    from './components/LedgerOperations';
import TransactionHistory  from './components/TransactionHistory';
import AuditLogViewer      from './components/AuditLogViewer';
import ServerStatus        from './components/ServerStatus';
import TransactionForm     from './components/TransactionForm';

function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [refresh,   setRefresh]   = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const bump = () => setRefresh((n) => n + 1);
  const openOperations = (account) => {
    setSelectedAccountId(account?.id || '');
    setActiveTab('Operations');
  };

  return (
    <div className="app-shell">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="page-container">
        {activeTab === 'Dashboard' && (
          <AccountList onSelect={openOperations} refresh={refresh} />
        )}
        {activeTab === 'Operations' && (
          <>
            <LedgerOperations onDone={bump} initialAccountId={selectedAccountId} />
            <TransactionForm onCreated={bump} />
          </>
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
  if (loading) return <div className="loading-state">Loading your workspace…</div>;
  return user ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <ServerStatus />
      <AppInner />
    </AuthProvider>
  );
}
