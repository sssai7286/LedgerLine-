const Transaction  = require('../models/Transaction');
const JournalEntry = require('../models/JournalEntry');

// ── GET /api/transactions ─────────────────────────────────────────
// ADMIN / AUDITOR → all transactions
// ACCOUNT_HOLDER  → only transactions they initiated
const getAllTransactions = async (req, res) => {
  try {
    const filter = req.user.role === 'ACCOUNT_HOLDER'
      ? { initiated_by: req.user._id }
      : {};

    const transactions = await Transaction.find(filter)
      .populate('initiated_by', 'name email')
      .sort({ created_at: -1 });

    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// ── GET /api/transactions/:id/entries ─────────────────────────────
const getTransactionEntries = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('initiated_by', 'name email');
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // ACCOUNT_HOLDER can only view their own transactions
    if (
      req.user.role === 'ACCOUNT_HOLDER' &&
      transaction.initiated_by._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const entries = await JournalEntry.find({ transaction_id: transaction._id })
      .populate('account_id', 'account_name account_type currency')
      .sort({ created_at: 1 });

    res.json({ transaction, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
};

module.exports = { getAllTransactions, getTransactionEntries };
