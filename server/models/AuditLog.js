const mongoose = require('mongoose');

/**
 * AuditLog
 * --------
 * Append-only record of every significant action in the system.
 * Documents are NEVER updated or deleted — only inserted.
 *
 * action types:
 *   AUTH_REGISTER, AUTH_LOGIN, AUTH_LOGOUT
 *   ACCOUNT_CREATE
 *   DEPOSIT, WITHDRAWAL, TRANSFER
 *   TX_CREATE
 *   BALANCE_VIEW, ACCOUNT_VIEW
 */
const auditLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    user_email: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      default: null,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    resource: {
      type: String,    // e.g. 'Account', 'Transaction'
      default: null,
    },
    resource_id: {
      type: String,    // the MongoDB _id of the resource
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,  // any extra context (amount, currency, etc.)
      default: {},
    },
    ip: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS',
    },
  },
  {
    // createdAt only — logs are immutable
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// Prevent any update or delete at the model level
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('AuditLog documents are immutable and cannot be modified or deleted');
});

auditLogSchema.index({ user_id: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ created_at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
