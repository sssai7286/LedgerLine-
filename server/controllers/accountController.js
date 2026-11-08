const pool = require('../config/db');

// GET /api/accounts
const getAllAccounts = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM accounts ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

// POST /api/accounts
const createAccount = async (req, res) => {
  const { owner_id, currency } = req.body;

  if (!owner_id || !currency) {
    return res.status(400).json({ error: 'owner_id and currency are required' });
  }
  if (currency.length !== 3) {
    return res.status(400).json({ error: 'currency must be a 3-letter ISO 4217 code' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO accounts (owner_id, currency) VALUES ($1, $2) RETURNING *',
      [owner_id, currency.toUpperCase()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
};

// GET /api/accounts/:id/balance
// Returns the running balance = SUM of all journal entry amounts for this account.
// Positive = net debit balance, Negative = net credit balance.
const getAccountBalance = async (req, res) => {
  const { id } = req.params;
  try {
    // Verify the account exists
    const acct = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
    if (acct.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::BIGINT AS balance
         FROM journal_entries
        WHERE account_id = $1`,
      [id]
    );

    res.json({
      account_id: id,
      currency:   acct.rows[0].currency,
      balance:    rows[0].balance,   // in cents / smallest unit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};

module.exports = { getAllAccounts, createAccount, getAccountBalance };
