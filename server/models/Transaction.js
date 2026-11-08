const mongoose = require('mongoose');

/**
 * Transaction
 * -----------
 * A single logical financial event.
 * Always has ≥ 2 JournalEntry documents linked to it.
 *
 * type:
 *   DEPOSIT    – money coming into an account from outside
 *   WITHDRAWAL – money leaving an account
 *   TRANSFER   – money moving between two accounts
 *
 * idempotency_key (unique index) – client-supplied key so that
 * retrying a failed request never double-posts money.
 * Recommended format: "{type}-{userId}-{timestamp}-{nonce}"
 *
 * status:
 *   PENDING   – being processed
 *   COMPLETED – committed successfully
 *   FAILED    – rolled back
 */
const transactionSchema = new mongoose.Schema(
  {
    idempotency_key: {
      type: String,
      required: [true, 'idempotency_key is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'type is required'],
      enum: {
        values: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'],
        message: 'type must be DEPOSIT, WITHDRAWAL, or TRANSFER',
      },
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    initiated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED',
    },
    // Total amount of the transaction in cents (absolute value)
    amount_cents: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// unique: true on the field already creates the index
transactionSchema.index({ initiated_by: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
