const { pool } = require('../config/db');

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const operationError = (status, message) => Object.assign(new Error(message), { status });

const createTransaction = async (req, res) => {
  const { idempotency_key, description, entries } = req.body;
  if (typeof idempotency_key !== 'string' || !idempotency_key.trim() || idempotency_key.length > 255) {
    return res.status(400).json({ error: 'idempotency_key is required and must be at most 255 characters' });
  }
  if (description != null && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be a string' });
  }
  if (!Array.isArray(entries) || entries.length < 2) {
    return res.status(400).json({ error: 'At least two journal entries are required' });
  }
  if (entries.some((entry) => !entry || !isUuid(entry.account_id)
    || !Number.isSafeInteger(entry.amount) || entry.amount === 0)) {
    return res.status(400).json({ error: 'Each entry requires a valid account ID and non-zero integer amount' });
  }
  const normalizedEntries = entries.map((entry) => ({
    account_id: entry.account_id.toLowerCase(),
    amount: entry.amount,
  }));
  let net = 0;
  for (const entry of normalizedEntries) {
    net += entry.amount;
    if (!Number.isSafeInteger(net)) {
      return res.status(400).json({ error: 'Journal entry total is outside the supported range' });
    }
  }
  if (net !== 0) {
    return res.status(400).json({ error: 'Journal entries must balance to zero' });
  }

  const accountIds = normalizedEntries.map((entry) => entry.account_id);
  if (new Set(accountIds).size !== accountIds.length) {
    return res.status(400).json({ error: 'Each account can appear only once per transaction' });
  }
  const amountCents = normalizedEntries.reduce((sum, entry) => sum + Math.max(entry.amount, 0), 0);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return res.status(400).json({ error: 'Transaction amount is outside the supported range' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT * FROM transactions WHERE idempotency_key = $1',
      [idempotency_key.trim()]
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return res.status(200).json({ transaction: existing.rows[0], idempotent: true });
    }

    const { rows: accounts } = await client.query(
      `SELECT * FROM accounts
       WHERE id = ANY($1::uuid[]) AND is_active = TRUE
       ORDER BY id FOR UPDATE`,
      [accountIds]
    );
    if (accounts.length !== accountIds.length) {
      throw operationError(404, 'Account not found or inactive');
    }
    const currencies = new Set(accounts.map((account) => account.currency));
    if (currencies.size !== 1) {
      throw operationError(400, 'All accounts must use the same currency');
    }
    if (req.user.role === 'ACCOUNT_HOLDER'
      && accounts.some((account) => account.user_id !== req.user.id)) {
      throw operationError(403, 'You can only post entries to your own accounts');
    }

    const deltas = new Map(normalizedEntries.map((entry) => [entry.account_id, entry.amount]));
    if (accounts.some((account) => {
      const newBalance = Number(account.balance_cents) + deltas.get(account.id);
      return !Number.isSafeInteger(newBalance) || newBalance < 0;
    })) {
      throw operationError(400, 'Transaction would result in an unsupported or negative account balance');
    }

    const currency = accounts[0].currency;
    const { rows } = await client.query(
      `INSERT INTO transactions
         (idempotency_key,type,description,initiated_by,amount_cents,currency)
       VALUES ($1,'TRANSFER',$2,$3,$4,$5) RETURNING *`,
      [
        idempotency_key.trim(),
        description?.trim() || 'Journal transaction',
        req.user.id,
        amountCents,
        currency,
      ]
    );
    const transaction = rows[0];
    for (const entry of normalizedEntries) {
      await client.query(
        'INSERT INTO journal_entries (transaction_id,account_id,amount) VALUES ($1,$2,$3)',
        [transaction.id, entry.account_id, entry.amount]
      );
      await client.query(
        'UPDATE accounts SET balance_cents = balance_cents + $1, updated_at = NOW() WHERE id = $2',
        [entry.amount, entry.account_id]
      );
    }

    await client.query(
      `INSERT INTO audit_logs
         (user_id,user_email,role,action,resource,resource_id,ip,status,meta)
       VALUES ($1,$2,$3,'TX_CREATE','Transaction',$4,$5,'SUCCESS',$6)`,
      [
        req.user.id,
        req.user.email,
        req.user.role,
        transaction.id,
        req.ip,
        JSON.stringify({ accountIds, amount_cents: amountCents, currency }),
      ]
    );
    await client.query('COMMIT');
    return res.status(201).json({ transaction });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Transaction rollback failed:', rollbackError.message);
    }
    if (err.code === '23505') {
      const { rows } = await pool.query(
        'SELECT * FROM transactions WHERE idempotency_key = $1',
        [idempotency_key.trim()]
      );
      if (rows[0]) return res.status(200).json({ transaction: rows[0], idempotent: true });
    }
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Failed to create transaction:', err.message);
    return res.status(500).json({ error: 'Failed to create transaction' });
  } finally {
    client.release();
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const isHolder = req.user.role === 'ACCOUNT_HOLDER';
    const { rows } = await pool.query(
      `SELECT t.*, u.name AS initiated_by_name, u.email AS initiated_by_email
       FROM transactions t
       JOIN users u ON u.id = t.initiated_by
       ${isHolder ? 'WHERE t.initiated_by = $1' : ''}
       ORDER BY t.created_at DESC`,
      isHolder ? [req.user.id] : []
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch transactions:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

const getTransactionEntries = async (req, res) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid transaction ID' });
  }

  try {
    const txResult = await pool.query(
      `SELECT t.*, u.name AS initiated_by_name, u.email AS initiated_by_email
       FROM transactions t
       JOIN users u ON u.id = t.initiated_by
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!txResult.rows[0]) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = txResult.rows[0];
    if (req.user.role === 'ACCOUNT_HOLDER' && transaction.initiated_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows: entries } = await pool.query(
      `SELECT je.*, a.account_name, a.account_type, a.currency
       FROM journal_entries je
       LEFT JOIN accounts a ON a.id = je.account_id
       WHERE je.transaction_id = $1
       ORDER BY je.created_at`,
      [req.params.id]
    );
    res.json({ transaction, entries });
  } catch (err) {
    console.error('Failed to fetch journal entries:', err.message);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
};

module.exports = { createTransaction, getAllTransactions, getTransactionEntries };
