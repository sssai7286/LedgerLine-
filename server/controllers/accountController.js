const Account      = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const AuditLog     = require('../models/AuditLog');

// ── GET /api/accounts ────────────────────────────────────────────
// ADMIN / AUDITOR → all accounts
// ACCOUNT_HOLDER  → own accounts only
const getAllAccounts = async (req, res) => {
  try {
    const filter = req.user.role === 'ACCOUNT_HOLDER'
      ? { user_id: req.user._id }
      : {};
    const accounts = await Account.find(filter).sort({ created_at: -1 });
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

// ── POST /api/accounts ───────────────────────────────────────────
// ADMIN or ACCOUNT_HOLDER (creates account for themselves)
const createAccount = async (req, res) => {
  const { account_name, account_type, currency } = req.body;

  if (!account_name || !currency) {
    return res.status(400).json({ error: 'account_name and currency are required' });
  }

  try {
    const account = await Account.create({
      user_id:      req.user._id,
      account_name,
      account_type: account_type?.toUpperCase() || 'ASSET',
      currency:     currency.toUpperCase(),
      balance_cents: 0,
    });

    await AuditLog.create({
      user_id:    req.user._id,
      user_email: req.user.email,
      role:       req.user.role,
      action:     'ACCOUNT_CREATE',
      resource:   'Account',
      resource_id: account._id.toString(),
      meta:       { account_name, currency, account_type },
      ip:         req.ip,
      status:     'SUCCESS',
    });

    res.status(201).json(account);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
};

// ── GET /api/accounts/:id ────────────────────────────────────────
const getAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    // ACCOUNT_HOLDER can only see own accounts
    if (
      req.user.role === 'ACCOUNT_HOLDER' &&
      account.user_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
};

// ── GET /api/accounts/:id/balance ────────────────────────────────
// Returns denormalised balance plus a live SUM from journal entries
// to detect any drift (should always match).
const getAccountBalance = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (
      req.user.role === 'ACCOUNT_HOLDER' &&
      account.user_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Aggregate live balance from journal entries for integrity check
    const result = await JournalEntry.aggregate([
      { $match: { account_id: account._id } },
      { $group: { _id: null, live_balance: { $sum: '$amount' } } },
    ]);
    const live_balance = result.length > 0 ? result[0].live_balance : 0;

    res.json({
      account_id:       account._id,
      account_name:     account.account_name,
      account_type:     account.account_type,
      currency:         account.currency,
      balance_cents:    account.balance_cents,  // denormalised
      live_balance,                             // from journal — must match
      balanced:         account.balance_cents === live_balance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};

// ── GET /api/accounts/:id/statement ──────────────────────────────
// All journal entries for an account (transaction statement)
const getStatement = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (
      req.user.role === 'ACCOUNT_HOLDER' &&
      account.user_id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const entries = await JournalEntry.find({ account_id: account._id })
      .populate('transaction_id', 'type description created_at idempotency_key')
      .sort({ created_at: -1 });

    res.json({ account, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch statement' });
  }
};

module.exports = { getAllAccounts, createAccount, getAccount, getAccountBalance, getStatement };
