import React, { useState } from 'react';
import AccountList     from './components/AccountList';
import TransactionForm from './components/TransactionForm';
import JournalEntries  from './components/JournalEntries';

export default function App() {
  // Increment to trigger JournalEntries to re-fetch after a new transaction
  const [txRefresh, setTxRefresh] = useState(0);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={{ margin: 0 }}>📒 Financial Ledger</h1>
        <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 14 }}>
          Double-entry bookkeeping — every transaction balances to zero
        </p>
      </header>

      <main style={styles.main}>
        <AccountList />
        <hr style={styles.divider} />
        <TransactionForm onCreated={() => setTxRefresh((n) => n + 1)} />
        <hr style={styles.divider} />
        <JournalEntries refresh={txRefresh} />
      </main>
    </div>
  );
}

const styles = {
  container: { fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f8fafc' },
  header:    { background: '#1e293b', color: '#fff', padding: '20px 32px' },
  main:      { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  divider:   { border: 'none', borderTop: '1px solid #e5e7eb', margin: '32px 0' },
};
