/**
 * LedgerLine – Database Seed Script
 * -----------------------------------
 * Creates demo users, accounts, and sample transactions.
 *
 * Usage:
 *   cd server
 *   node db/seed.js
 *
 * WARNING: Clears all existing data before seeding.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose    = require('mongoose');
const bcrypt      = require('bcryptjs');
const User        = require('../models/User');
const Account     = require('../models/Account');
const Transaction = require('../models/Transaction');
const JournalEntry= require('../models/JournalEntry');
const AuditLog    = require('../models/AuditLog');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ledgerline';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  // Clear all collections
  await Promise.all([
    User.deleteMany({}),
    Account.deleteMany({}),
    Transaction.deleteMany({}),
    JournalEntry.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('Cleared existing data.');

  // ── Create users ───────────────────────────────────────────────
  const password = await bcrypt.hash('password123', 12);

  const [admin, alice, bob, auditor] = await User.insertMany([
    { name: 'Admin User',   email: 'admin@ledgerline.com',  password, role: 'ADMIN'           },
    { name: 'Alice Smith',  email: 'alice@ledgerline.com',  password, role: 'ACCOUNT_HOLDER'  },
    { name: 'Bob Jones',    email: 'bob@ledgerline.com',    password, role: 'ACCOUNT_HOLDER'  },
    { name: 'Eve Auditor',  email: 'auditor@ledgerline.com',password, role: 'AUDITOR'         },
  ]);
  console.log('Created users: admin, alice, bob, auditor');

  // ── Create accounts ────────────────────────────────────────────
  const [aliceChecking, aliceSavings, bobChecking] = await Account.insertMany([
    { user_id: alice._id, account_name: 'Alice Checking', account_type: 'ASSET', currency: 'USD', balance_cents: 0 },
    { user_id: alice._id, account_name: 'Alice Savings',  account_type: 'ASSET', currency: 'USD', balance_cents: 0 },
    { user_id: bob._id,   account_name: 'Bob Checking',   account_type: 'ASSET', currency: 'USD', balance_cents: 0 },
  ]);
  console.log('Created accounts: Alice Checking, Alice Savings, Bob Checking');

  // ── Seed transactions ──────────────────────────────────────────
  // 1. Deposit $500 into Alice Checking
  const dep1 = await Transaction.create({
    idempotency_key: 'seed-dep-alice-1', type: 'DEPOSIT',
    description: 'Initial deposit', initiated_by: alice._id,
    amount_cents: 50000, currency: 'USD',
  });
  await JournalEntry.create({ transaction_id: dep1._id, account_id: aliceChecking._id, amount: 50000 });
  await Account.findByIdAndUpdate(aliceChecking._id, { $inc: { balance_cents: 50000 } });

  // 2. Deposit $300 into Bob Checking
  const dep2 = await Transaction.create({
    idempotency_key: 'seed-dep-bob-1', type: 'DEPOSIT',
    description: 'Initial deposit', initiated_by: bob._id,
    amount_cents: 30000, currency: 'USD',
  });
  await JournalEntry.create({ transaction_id: dep2._id, account_id: bobChecking._id, amount: 30000 });
  await Account.findByIdAndUpdate(bobChecking._id, { $inc: { balance_cents: 30000 } });

  // 3. Transfer $100 from Alice Checking → Alice Savings
  const xfer1 = await Transaction.create({
    idempotency_key: 'seed-xfer-alice-1', type: 'TRANSFER',
    description: 'Move to savings', initiated_by: alice._id,
    amount_cents: 10000, currency: 'USD',
  });
  await JournalEntry.insertMany([
    { transaction_id: xfer1._id, account_id: aliceChecking._id, amount: -10000 },
    { transaction_id: xfer1._id, account_id: aliceSavings._id,  amount:  10000 },
  ]);
  await Account.findByIdAndUpdate(aliceChecking._id, { $inc: { balance_cents: -10000 } });
  await Account.findByIdAndUpdate(aliceSavings._id,  { $inc: { balance_cents:  10000 } });

  // 4. Withdraw $50 from Bob Checking
  const wd1 = await Transaction.create({
    idempotency_key: 'seed-wd-bob-1', type: 'WITHDRAWAL',
    description: 'ATM withdrawal', initiated_by: bob._id,
    amount_cents: 5000, currency: 'USD',
  });
  await JournalEntry.create({ transaction_id: wd1._id, account_id: bobChecking._id, amount: -5000 });
  await Account.findByIdAndUpdate(bobChecking._id, { $inc: { balance_cents: -5000 } });

  console.log('Seeded transactions: 2 deposits, 1 transfer, 1 withdrawal');

  // ── Print final balances ───────────────────────────────────────
  const accounts = await Account.find({});
  console.log('\nFinal balances:');
  accounts.forEach((a) => console.log(`  ${a.account_name}: $${(a.balance_cents / 100).toFixed(2)}`));

  console.log('\n Demo login credentials (password: password123):');
  console.log('  admin@ledgerline.com    → ADMIN');
  console.log('  alice@ledgerline.com    → ACCOUNT_HOLDER');
  console.log('  bob@ledgerline.com      → ACCOUNT_HOLDER');
  console.log('  auditor@ledgerline.com  → AUDITOR');

  await mongoose.disconnect();
  console.log('\nSeed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
