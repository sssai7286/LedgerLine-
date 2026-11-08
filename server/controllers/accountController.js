const Account      = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');

// ── GET /api/accounts ────────────────────────────────────────────
const getAllAccounts = async (req, res) => {
  try {
    const accounts = await Account.find().sort({ created_at: -1 });
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

// ── POST /api/accounts ───────────────────────────────────────────
// Body: { owner_id, account_name, account_type, currency }
const createAccount = async (req, res) => {
  const { owner_id, account_name, account_type, currency } = req.body;

  if (!owner_id || !account_name || !account_type || !currency) {
    return res.status(400).json({
      error: 'owner_id, account_name, account_type, and currency are required',
    });
  }

  try {
    const account = await Account.create({
      owner_id,
      account_name,
      account_type: account_type.toUpperCase(),
      currency:     currency.toUpperCase(),
    });
    res.status(201).json(account);
  } catch (err) {
    console.error(err);
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create account' });
  }
};

// ── GET /api/accounts/:id/balance ────────────────────────────────
// Running balance = SUM of all journal entry amounts for this account.
// Positive → net debit balance   (normal for ASSET / EXPENSE)
// Negative → net credit balance  (normal for LIABILITY / EQUITY / INCOME)
const getAccountBalance = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const result = await JournalEntry.aggregate([
      { $match: { account_id: account._id } },
      { $group: { _id: null, balance: { $sum: '$amount' } } },
    ]);

    const balance = result.length > 0 ? result[0].balance : 0;

    res.json({
      account_id:   account._id,
      account_name: account.account_name,
      account_type: account.account_type,
      currency:     account.currency,
      balance,              // integer cents
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};

module.exports = { getAllAccounts, createAccount, getAccountBalance };
