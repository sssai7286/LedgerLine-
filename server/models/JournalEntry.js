const mongoose = require('mongoose');

/**
 * JournalEntry
 * ------------
 * Each document is one "leg" of a double-entry transaction.
 *
 * WHY store amount as a Number (integer) instead of floating point?
 *   MongoDB's Number maps to a 64-bit IEEE 754 double, which can
 *   represent integers exactly up to 2^53 (~9 quadrillion cents).
 *   By always storing cents (smallest currency unit) and never
 *   storing fractional units, every arithmetic operation is
 *   exact – no rounding errors.
 *
 *   $1.99  →  199
 *   ¥500   →  500  (JPY has no sub-unit)
 *   ₹1.50  →  150  (paise)
 *
 * Convention:
 *   amount > 0  →  DEBIT   (value flows INTO  the account)
 *   amount < 0  →  CREDIT  (value flows OUT OF the account)
 *
 * Double-entry invariant:
 *   SUM(amount) = 0  for all entries sharing a transaction_id
 *   Enforced in transactionController before any DB write.
 */
const journalEntrySchema = new mongoose.Schema(
  {
    transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: [true, 'transaction_id is required'],
    },
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'account_id is required'],
    },
    // Stored as integer cents – validate it is a non-zero integer
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      validate: [
        {
          validator: Number.isInteger,
          message: 'amount must be an integer (cents / smallest currency unit)',
        },
        {
          validator: (v) => v !== 0,
          message: 'amount must be non-zero',
        },
      ],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

journalEntrySchema.index({ transaction_id: 1 });
journalEntrySchema.index({ account_id: 1 });

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
