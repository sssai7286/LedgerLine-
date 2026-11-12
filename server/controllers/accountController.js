const { pool } = require('../config/db');

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getAllAccounts = async (req, res) => {
  try {
    const isHolder = req.user.role === 'ACCOUNT_HOLDER';
    const { rows } = await pool.query(
      isHolder
        ? 'SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC'
        : 'SELECT * FROM accounts ORDER BY created_at DESC',
      isHolder ? [req.user.id] : []
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch accounts:', err.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

const createAccount = async (req, res) => {
  const { account_name, account_type, currency } = req.body;
  if (typeof account_name !== 'string' || !account_name.trim() || account_name.trim().length > 120
    || typeof currency !== 'string'
    || (account_type != null && typeof account_type !== 'string')) {
    return res.status(400).json({ error: 'account_name (1-120 characters) and currency are required' });
  }
  if (!/^[A-Z]{3}$/i.test(currency)) {
    return res.status(400).json({ error: 'currency must be a 3-letter ISO 4217 code' });
  }

  const type = (account_type || 'ASSET').toUpperCase();
  const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `account_type must be one of ${validTypes.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO accounts (user_id, account_name, account_type, currency)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, account_name.trim(), type, currency.toUpperCase()]
    );
    const account = rows[0];
    await client.query(
      `INSERT INTO audit_logs
         (user_id,user_email,role,action,resource,resource_id,ip,status,meta)
       VALUES ($1,$2,$3,'ACCOUNT_CREATE','Account',$4,$5,'SUCCESS',$6)`,
      [req.user.id, req.user.email, req.user.role, account.id, req.ip,
        JSON.stringify({ account_name: account.account_name, currency: account.currency, account_type: type })]
    );
    await client.query('COMMIT');
    res.status(201).json(account);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Account creation rollback failed:', rollbackError.message);
    }
    console.error('Failed to create account:', err.message);
    res.status(500).json({ error: 'Failed to create account' });
  } finally {
    client.release();
  }
};

const loadAccount = async (req, res) => {
  if (!isUuid(req.params.id)) {
    res.status(400).json({ error: 'Invalid account ID' });
    return null;
  }
  const { rows } = await pool.query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Account not found' });
    return null;
  }
  const account = rows[0];
  if (req.user.role === 'ACCOUNT_HOLDER' && account.user_id !== req.user.id) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }
  return account;
};

const getAccount = async (req, res) => {
  try {
    const account = await loadAccount(req, res);
    if (account) res.json(account);
  } catch (err) {
    console.error('Failed to fetch account:', err.message);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
};

const getAccountBalance = async (req, res) => {
  try {
    const account = await loadAccount(req, res);
    if (!account) return;

    const liveResult = await pool.query(
      'SELECT COALESCE(SUM(amount),0)::BIGINT AS live_balance FROM journal_entries WHERE account_id=$1',
      [account.id]
    );
    const balance = Number(account.balance_cents);
    const liveBalance = Number(liveResult.rows[0].live_balance);
    res.json({
      account_id: account.id,
      account_name: account.account_name,
      account_type: account.account_type,
      currency: account.currency,
      balance_cents: balance,
      live_balance: liveBalance,
      balanced: balance === liveBalance,
    });
  } catch (err) {
    console.error('Failed to fetch balance:', err.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};

const getStatement = async (req, res) => {
  try {
    const account = await loadAccount(req, res);
    if (!account) return;

    const entries = await pool.query(
      `SELECT je.*, t.type, t.description, t.idempotency_key, t.created_at AS tx_created_at
       FROM journal_entries je
       JOIN transactions t ON t.id = je.transaction_id
       WHERE je.account_id = $1
       ORDER BY je.created_at DESC`,
      [account.id]
    );
    res.json({ account, entries: entries.rows });
  } catch (err) {
    console.error('Failed to fetch statement:', err.message);
    res.status(500).json({ error: 'Failed to fetch statement' });
  }
};

module.exports = { getAllAccounts, createAccount, getAccount, getAccountBalance, getStatement };
