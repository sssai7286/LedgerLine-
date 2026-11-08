const mongoose = require('mongoose');

/**
 * Transaction
 * -----------
 * A single logical financial event ("Pay vendor invoice #42").
 * Always has ≥ 2 JournalEntry documents linked to it.
 *
 * idempotency_key (unique index) – client-supplied key so that
 * retrying a failed HTTP call never double-posts money.
 * Use a deterministic key like "transfer-{userId}-{orderId}".
 */
const transactionSchema = new mongoose.Schema(
  {
    idempotency_key: {
      type: String,
      required: [true, 'idempotency_key is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

transactionSchema.index({ idempotency_key: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);
