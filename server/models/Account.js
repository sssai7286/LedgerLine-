const mongoose = require('mongoose');

/**
 * Account
 * -------
 * Represents a ledger account owned by a user.
 *
 * account_type follows standard bookkeeping categories:
 *   ASSET      – things owned (cash, receivables)
 *   LIABILITY  – things owed  (loans, payables)
 *   EQUITY     – net worth / capital
 *   INCOME     – revenue earned
 *   EXPENSE    – costs incurred
 *
 * currency is a 3-letter ISO 4217 code (USD, EUR, INR …)
 */
const accountSchema = new mongoose.Schema(
  {
    owner_id: {
      type: String,
      required: [true, 'owner_id is required'],
      trim: true,
    },
    account_name: {
      type: String,
      required: [true, 'account_name is required'],
      trim: true,
    },
    account_type: {
      type: String,
      required: [true, 'account_type is required'],
      enum: {
        values: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'],
        message: 'account_type must be ASSET, LIABILITY, EQUITY, INCOME, or EXPENSE',
      },
    },
    currency: {
      type: String,
      required: [true, 'currency is required'],
      uppercase: true,
      trim: true,
      validate: {
        validator: (v) => /^[A-Z]{3}$/.test(v),
        message: 'currency must be a 3-letter ISO 4217 code (e.g. USD)',
      },
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

accountSchema.index({ owner_id: 1 });

module.exports = mongoose.model('Account', accountSchema);
