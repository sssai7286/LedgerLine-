const mongoose    = require('mongoose');
const Account      = require('../models/Account');
const Transaction  = require('../models/Transaction');
const JournalEntry = require('../models/JournalEntry');
const AuditLog     = require('../models/AuditLog');

/**
 * Shared helper — writes journal entries + updates denormalised balances
 * atomically inside an existing Mongoose session.
 *
 * legs: [{ account_id, amount }]  (amount > 0 = debit, < 0 = credit)
 * Invariant enforced: SUM(legs.amount) === 0
 */
async function postJournalLegs(transaction, legs, session) {
  // Double-entry invariant check
  const net = legs.reduce((s, l) => s + l.amount, 0);
  if (net !== 0) {
    throw new Error(`Unbalanced journal legs: net = ${net}, must be 0`);
  }

  // Insert journal entries
  await JournalEntry.create(
    legs.map((l) => ({
      transaction_id: transaction._id,
      account_id:     l.account_id,
      amount:         l.amount,
    })),
    { session }
  );

  // Update denormalised balance on each account atomically
  for (const leg of legs) {
    const updated = await Account.findOneAndUpdate(
      {
        _id:       leg.account_id,
        is_active: true,
        // Prevent negative balance: only allow debit if balance >= |credit|
        ...(leg.amount < 0
          ? { balance_cents: { $gte: Math.abs(leg.amount) } }
          : {}),
      },
      { $inc: { balance_cents: leg.amount } },
      { new: true, session }
    );

    if (!updated) {
      // Either account not found, inactive, or insufficient balance
      const acct = await Account.findById(leg.account_id).session(session);
      if (!acct || !acct.is_active) {
        throw new Error(`Account ${leg.account_id} not found or inactive`);
      }
      throw new Error(
        `Insufficient balance on account ${acct.account_name}: ` +
        `has ${acct.balance_cents} cents, needs ${Math.abs(leg.amount)} cents`
      );
    }
  }
}

// ── POST /api/ledger/deposit ──────────────────────────────────────
// Body: { account_id, amount_cents, currency, idempotency_key, description }
const deposit = async (req, res) => {
  const { account_id, amount_cents, currency, idempotency_key, description } = req.body;

  if (!account_id || !amount_cents || !currency || !idempotency_key) {
    return res.status(400).json({
      error: 'account_id, amount_cents, currency, and idempotency_key are required',
    });
  }
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    return res.status(400).json({ error: 'amount_cents must be a positive integer' });
  }

  // Idempotency — return existing transaction if key already used
  const existing = await Transaction.findOne({ idempotency_key });
  if (existing) {
    return res.status(200).json({ transaction: existing, idempotent: true });
  }

  const account = await Account.findById(account_id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (!account.is_active) return res.status(400).json({ error: 'Account is inactive' });

  // ACCOUNT_HOLDER may only deposit into their own accounts
  if (
    req.user.role === 'ACCOUNT_HOLDER' &&
    account.user_id.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const [transaction] = await Transaction.create(
      [{
        idempotency_key,
        type:         'DEPOSIT',
        description:  description || `Deposit to ${account.account_name}`,
        initiated_by: req.user._id,
        amount_cents,
        currency:     currency.toUpperCase(),
      }],
      { session }
    );

    // Deposit: DEBIT the account (+amount)
    // Contra: CREDIT a virtual "External Funds" account (not tracked, so
    // we create a single-leg debit — the external source is outside the ledger)
    // For a closed ledger with an external entry account, add an external account.
    // Here we use a single-leg per industry practice for external deposits.
    await JournalEntry.create(
      [{ transaction_id: transaction._id, account_id, amount: amount_cents }],
      { session }
    );

    await Account.findByIdAndUpdate(
      account_id,
      { $inc: { balance_cents: amount_cents } },
      { session }
    );

    await session.commitTransaction();

    await AuditLog.create({
      user_id:    req.user._id,
      user_email: req.user.email,
      role:       req.user.role,
      action:     'DEPOSIT',
      resource:   'Transaction',
      resource_id: transaction._id.toString(),
      meta:       { account_id, amount_cents, currency },
      ip:         req.ip,
      status:     'SUCCESS',
    });

    res.status(201).json({ transaction });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate idempotency_key' });
    }
    res.status(500).json({ error: err.message || 'Deposit failed' });
  } finally {
    session.endSession();
  }
};

// ── POST /api/ledger/withdraw ─────────────────────────────────────
// Body: { account_id, amount_cents, currency, idempotency_key, description }
const withdraw = async (req, res) => {
  const { account_id, amount_cents, currency, idempotency_key, description } = req.body;

  if (!account_id || !amount_cents || !currency || !idempotency_key) {
    return res.status(400).json({
      error: 'account_id, amount_cents, currency, and idempotency_key are required',
    });
  }
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    return res.status(400).json({ error: 'amount_cents must be a positive integer' });
  }

  const existing = await Transaction.findOne({ idempotency_key });
  if (existing) {
    return res.status(200).json({ transaction: existing, idempotent: true });
  }

  const account = await Account.findById(account_id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (!account.is_active) return res.status(400).json({ error: 'Account is inactive' });

  if (
    req.user.role === 'ACCOUNT_HOLDER' &&
    account.user_id.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Pre-flight balance check (optimistic — re-checked atomically in update)
  if (account.balance_cents < amount_cents) {
    return res.status(400).json({
      error: `Insufficient balance: has ${account.balance_cents} cents, needs ${amount_cents} cents`,
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const [transaction] = await Transaction.create(
      [{
        idempotency_key,
        type:         'WITHDRAWAL',
        description:  description || `Withdrawal from ${account.account_name}`,
        initiated_by: req.user._id,
        amount_cents,
        currency:     currency.toUpperCase(),
      }],
      { session }
    );

    // CREDIT the account (negative amount = money leaves)
    await JournalEntry.create(
      [{ transaction_id: transaction._id, account_id, amount: -amount_cents }],
      { session }
    );

    // Atomic balance decrement — fails if balance would go negative
    const updated = await Account.findOneAndUpdate(
      { _id: account_id, balance_cents: { $gte: amount_cents } },
      { $inc: { balance_cents: -amount_cents } },
      { new: true, session }
    );

    if (!updated) {
      throw new Error('Insufficient balance (concurrent update conflict)');
    }

    await session.commitTransaction();

    await AuditLog.create({
      user_id:    req.user._id,
      user_email: req.user.email,
      role:       req.user.role,
      action:     'WITHDRAWAL',
      resource:   'Transaction',
      resource_id: transaction._id.toString(),
      meta:       { account_id, amount_cents, currency },
      ip:         req.ip,
      status:     'SUCCESS',
    });

    res.status(201).json({ transaction });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate idempotency_key' });
    }
    res.status(400).json({ error: err.message || 'Withdrawal failed' });
  } finally {
    session.endSession();
  }
};

// ── POST /api/ledger/transfer ─────────────────────────────────────
// Body: { from_account_id, to_account_id, amount_cents, currency, idempotency_key, description }
const transfer = async (req, res) => {
  const {
    from_account_id,
    to_account_id,
    amount_cents,
    currency,
    idempotency_key,
    description,
  } = req.body;

  if (!from_account_id || !to_account_id || !amount_cents || !currency || !idempotency_key) {
    return res.status(400).json({
      error: 'from_account_id, to_account_id, amount_cents, currency, and idempotency_key are required',
    });
  }
  if (from_account_id === to_account_id) {
    return res.status(400).json({ error: 'Cannot transfer to the same account' });
  }
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    return res.status(400).json({ error: 'amount_cents must be a positive integer' });
  }

  const existing = await Transaction.findOne({ idempotency_key });
  if (existing) {
    return res.status(200).json({ transaction: existing, idempotent: true });
  }

  const [fromAccount, toAccount] = await Promise.all([
    Account.findById(from_account_id),
    Account.findById(to_account_id),
  ]);

  if (!fromAccount) return res.status(404).json({ error: 'Source account not found' });
  if (!toAccount)   return res.status(404).json({ error: 'Destination account not found' });
  if (!fromAccount.is_active) return res.status(400).json({ error: 'Source account is inactive' });
  if (!toAccount.is_active)   return res.status(400).json({ error: 'Destination account is inactive' });

  // Ownership check — ACCOUNT_HOLDER must own the source account
  if (
    req.user.role === 'ACCOUNT_HOLDER' &&
    fromAccount.user_id.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ error: 'Access denied: you do not own the source account' });
  }

  if (fromAccount.balance_cents < amount_cents) {
    return res.status(400).json({
      error: `Insufficient balance: has ${fromAccount.balance_cents} cents, needs ${amount_cents} cents`,
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const [transaction] = await Transaction.create(
      [{
        idempotency_key,
        type:         'TRANSFER',
        description:  description || `Transfer: ${fromAccount.account_name} → ${toAccount.account_name}`,
        initiated_by: req.user._id,
        amount_cents,
        currency:     currency.toUpperCase(),
      }],
      { session }
    );

    // True double-entry: CREDIT source, DEBIT destination — NET = 0
    await postJournalLegs(
      transaction,
      [
        { account_id: from_account_id, amount: -amount_cents }, // CREDIT source
        { account_id: to_account_id,   amount:  amount_cents }, // DEBIT  destination
      ],
      session
    );

    await session.commitTransaction();

    await AuditLog.create({
      user_id:    req.user._id,
      user_email: req.user.email,
      role:       req.user.role,
      action:     'TRANSFER',
      resource:   'Transaction',
      resource_id: transaction._id.toString(),
      meta:       { from_account_id, to_account_id, amount_cents, currency },
      ip:         req.ip,
      status:     'SUCCESS',
    });

    res.status(201).json({ transaction });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate idempotency_key' });
    }
    res.status(400).json({ error: err.message || 'Transfer failed' });
  } finally {
    session.endSession();
  }
};

module.exports = { deposit, withdraw, transfer };
