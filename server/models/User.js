const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

/**
 * User
 * ----
 * Roles:
 *   ADMIN        – full access: create accounts, view all, manage users
 *   ACCOUNT_HOLDER – can view/operate own accounts only
 *   AUDITOR      – read-only access to all transactions and audit logs
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: {
        values: ['ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR'],
        message: 'role must be ADMIN, ACCOUNT_HOLDER, or AUDITOR',
      },
      default: 'ACCOUNT_HOLDER',
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

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare plain password to hash
userSchema.methods.matchPassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
