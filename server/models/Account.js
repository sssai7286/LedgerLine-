const mongoose = require('mongoose');

/**
 * Account
 * -------
 * Represents a ledger account owned by a user.
 *
 * account_type:
 *   ASSET / LIABILITY / EQUITY / INCOME / EXPENSE
 *
 * balance_cents: denormalised running balance (integer, cents).
 *   Kept in sync by every deposit/withdrawal/transfer operation.
 *   Updated atomically using findOneAndUpdate with $inc so
 *   concurrent requests never produce a race condition.
 *   Server-side CHECK: balance_cents >= 0 is enforced before
 *   any debit is committed.
 */
const accountSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user_id is required'],
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
      default: 'ASSET',
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
    // Denormalised balance — integer cents, always >= 0 for ASSET accounts
    balance_cents: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'balance_cents must be an integer',
      },
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

accountSchema.index({ user_id: 1 });

module.exports = mongoose.model('Account', accountSchema);
