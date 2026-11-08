const mongoose    = require('mongoose');
const Transaction  = require('../models/Transaction');
const JournalEntry = require('../models/JournalEntry');
const Account      = require('../models/Account');

// ── GET /api/transactions ─────────────────────────────────────────
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ created_at: -1 });
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// ── POST /api/transactions ────────────────────────────────────────
// Body: { idempotency_key, description, entries: [{ account_id, amount }] }
//
// Double-entry rule enforced here (application layer):
//   SUM(entries[].amount) must equal 0
//   e.g. [{ account_id: A, amount: -10000 }, { account_id: B, amount: 10000 }]
//
// All writes run inside a MongoDB session (transaction) so either
// everything commits or nothing does — atomic write guarantee.
const createTransaction = async (req, res) => {
  const { idempotency_key, description, entries } = req.body;

  // ── Basic validation ──────────────────────────────────────────
  if (!idempotency_key) {
    return res.status(400).json({ error: 'idempotency_key is required' });
  }
  if (!Array.isArray(entries) || entries.length < 2) {
    return res.status(400).json({
      error: 'entries must be an array with at least 2 legs',
    });
  }

  // ── Double-entry balance check ────────────────────────────────
  const netAmount = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  if (netAmount !== 0) {
    return res.status(400).json({
      error: `Unbalanced transaction: entries sum to ${netAmount} cents, must be 0`,
    });
  }

  // ── Per-entry validation ──────────────────────────────────────
  for (const entry of entries) {
    if (!entry.account_id || entry.amount === undefined) {
      return res.status(400).json({ error: 'Each entry needs account_id and amount' });
    }
    if (!Number.isInteger(Number(entry.amount)) || Number(entry.amount) === 0) {
      return res.status(400).json({
        error: 'amount must be a non-zero integer (smallest currency unit, e.g. cents)',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(entry.account_id)) {
      return res.status(400).json({ error: `Invalid account_id: ${entry.account_id}` });
    }
  }

  // ── Verify all accounts exist ─────────────────────────────────
  const accountIds = entries.map((e) => e.account_id);
  const foundAccounts = await Account.find({ _id: { $in: accountIds } });
  if (foundAccounts.length !== new Set(accountIds).size) {
    return res.status(404).json({ error: 'One or more account_ids do not exist' });
  }

  // ── Atomic write using MongoDB session ────────────────────────
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 1. Create the transaction header
    const [transaction] = await Transaction.create(
      [{ idempotency_key, description: description || null }],
      { session }
    );

    // 2. Create all journal entry legs
    const entryDocs = entries.map((e) => ({
      transaction_id: transaction._id,
      account_id:     e.account_id,
      amount:         Number(e.amount),
    }));
    const insertedEntries = await JournalEntry.create(entryDocs, { session });

    await session.commitTransaction();

    res.status(201).json({ transaction, entries: insertedEntries });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);

    // Duplicate idempotency key → 409 Conflict
    if (err.code === 11000) {
      return res.status(409).json({
        error: `Transaction with idempotency_key '${idempotency_key}' already exists`,
      });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Failed to create transaction' });
  } finally {
    session.endSession();
  }
};

// ── GET /api/transactions/:id/entries ─────────────────────────────
const getTransactionEntries = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Populate account currency so the frontend can format amounts
    const entries = await JournalEntry.find({ transaction_id: transaction._id })
      .populate('account_id', 'account_name account_type currency')
      .sort({ created_at: 1 });

    res.json({ transaction, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
};

module.exports = { getAllTransactions, createTransaction, getTransactionEntries };
