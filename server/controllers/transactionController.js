const pool = require('../config/db');

// GET /api/transactions
const getAllTransactions = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM transactions ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// POST /api/transactions
// Body: { idempotency_key, description, entries: [{ account_id, amount }] }
//
// Double-entry rule enforced here:
//   SUM(entries[].amount) must equal 0
//   e.g. [{ account_id: A, amount: -10000 }, { account_id: B, amount: 10000 }]
//
// All inserts run inside a single DB transaction so either everything
// commits or nothing does.
const createTransaction = async (req, res) => {
  const { idempotency_key, description, entries } = req.body;

  // --- Validation ---
  if (!idempotency_key) {
    return res.status(400).json({ error: 'idempotency_key is required' });
  }
  if (!Array.isArray(entries) || entries.length < 2) {
    return res.status(400).json({ error: 'entries must be an array with at least 2 legs' });
  }

  // Enforce double-entry balance at the application layer
  const netAmount = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  if (netAmount !== 0) {
    return res.status(400).json({
      error: `Unbalanced transaction: entries sum to ${netAmount}, must be 0`,
    });
  }

  // Validate individual entries
  for (const entry of entries) {
    if (!entry.account_id || entry.amount === undefined) {
      return res.status(400).json({ error: 'Each entry needs account_id and amount' });
    }
    if (!Number.isInteger(Number(entry.amount)) || Number(entry.amount) === 0) {
      return res.status(400).json({ error: 'amount must be a non-zero integer (cents)' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert the transaction header
    const txResult = await client.query(
      `INSERT INTO transactions (idempotency_key, description)
       VALUES ($1, $2) RETURNING *`,
      [idempotency_key, description || null]
    );
    const transaction = txResult.rows[0];

    // Insert all journal entry legs
    const insertedEntries = [];
    for (const entry of entries) {
      const jeResult = await client.query(
        `INSERT INTO journal_entries (transaction_id, account_id, amount)
         VALUES ($1, $2, $3) RETURNING *`,
        [transaction.id, entry.account_id, entry.amount]
      );
      insertedEntries.push(jeResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({ transaction, entries: insertedEntries });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);

    // Handle duplicate idempotency key gracefully
    if (err.code === '23505') {
      return res.status(409).json({
        error: `Transaction with idempotency_key '${idempotency_key}' already exists`,
      });
    }

    res.status(500).json({ error: err.message || 'Failed to create transaction' });
  } finally {
    client.release();
  }
};

// GET /api/transactions/:id/entries
const getTransactionEntries = async (req, res) => {
  const { id } = req.params;
  try {
    const tx = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (tx.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { rows } = await pool.query(
      `SELECT je.*, a.currency
         FROM journal_entries je
         JOIN accounts a ON a.id = je.account_id
        WHERE je.transaction_id = $1
        ORDER BY je.created_at`,
      [id]
    );

    res.json({ transaction: tx.rows[0], entries: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
};

module.exports = { getAllTransactions, createTransaction, getTransactionEntries };
