require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool, connectDB } = require('../config/db');

async function seed() {
  await connectDB();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_no_update_delete');
    await client.query('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_no_truncate');
    await client.query(
      'TRUNCATE TABLE audit_logs, journal_entries, transactions, accounts, users RESTART IDENTITY CASCADE'
    );
    await client.query('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_no_update_delete');
    await client.query('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_no_truncate');

    const password = await bcrypt.hash('password123', 12);
    const users = await Promise.all([
      client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id',
        ['Admin User', 'admin@ledgerline.com', password, 'ADMIN']
      ),
      client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id',
        ['Alice Smith', 'alice@ledgerline.com', password, 'ACCOUNT_HOLDER']
      ),
      client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id',
        ['Bob Jones', 'bob@ledgerline.com', password, 'ACCOUNT_HOLDER']
      ),
      client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id',
        ['Eve Auditor', 'auditor@ledgerline.com', password, 'AUDITOR']
      ),
    ]);
    const userIds = users.map((result) => result.rows[0].id);
    const alice = userIds[1];
    const bob = userIds[2];

    const accounts = await Promise.all([
      client.query(
        `INSERT INTO accounts (user_id, account_name, account_type, currency)
         VALUES ($1,'Alice Checking','ASSET','USD') RETURNING id`,
        [alice]
      ),
      client.query(
        `INSERT INTO accounts (user_id, account_name, account_type, currency)
         VALUES ($1,'Alice Savings','ASSET','USD') RETURNING id`,
        [alice]
      ),
      client.query(
        `INSERT INTO accounts (user_id, account_name, account_type, currency)
         VALUES ($1,'Bob Checking','ASSET','USD') RETURNING id`,
        [bob]
      ),
    ]);
    const [aliceChecking, aliceSavings, bobChecking] = accounts.map((result) => result.rows[0].id);

    const addTransaction = async (key, type, description, userId, amount, entries) => {
      const { rows } = await client.query(
        `INSERT INTO transactions (idempotency_key,type,description,initiated_by,amount_cents,currency)
         VALUES ($1,$2,$3,$4,$5,'USD') RETURNING id`,
        [key, type, description, userId, amount]
      );
      const transactionId = rows[0].id;
      for (const [accountId, entryAmount] of entries) {
        await client.query(
          'INSERT INTO journal_entries (transaction_id,account_id,amount) VALUES ($1,$2,$3)',
          [transactionId, accountId, entryAmount]
        );
      }
    };

    await addTransaction(
      'seed-dep-alice-1', 'DEPOSIT', 'Initial deposit', alice, 50000,
      [[aliceChecking, 50000], [null, -50000]]
    );
    await client.query('UPDATE accounts SET balance_cents = 50000 WHERE id = $1', [aliceChecking]);
    await addTransaction(
      'seed-dep-bob-1', 'DEPOSIT', 'Initial deposit', bob, 30000,
      [[bobChecking, 30000], [null, -30000]]
    );
    await client.query('UPDATE accounts SET balance_cents = 30000 WHERE id = $1', [bobChecking]);
    await addTransaction(
      'seed-xfer-alice-1', 'TRANSFER', 'Move to savings', alice, 10000,
      [[aliceChecking, -10000], [aliceSavings, 10000]]
    );
    await client.query('UPDATE accounts SET balance_cents = 40000 WHERE id = $1', [aliceChecking]);
    await client.query('UPDATE accounts SET balance_cents = 10000 WHERE id = $1', [aliceSavings]);
    await addTransaction(
      'seed-wd-bob-1', 'WITHDRAWAL', 'ATM withdrawal', bob, 5000,
      [[bobChecking, -5000], [null, 5000]]
    );
    await client.query('UPDATE accounts SET balance_cents = 25000 WHERE id = $1', [bobChecking]);

    await client.query('COMMIT');
    console.log('Seeded demo users, accounts, and balanced transactions.');
    console.log('Demo logins (password: password123):');
    console.log('  admin@ledgerline.com (ADMIN)');
    console.log('  alice@ledgerline.com (ACCOUNT_HOLDER)');
    console.log('  bob@ledgerline.com (ACCOUNT_HOLDER)');
    console.log('  auditor@ledgerline.com (AUDITOR)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(async (err) => {
  console.error('Seed failed:', err.message);
  try {
    await pool.end();
  } catch (closeError) {
    console.error('Failed to close PostgreSQL pool:', closeError.message);
  }
  process.exitCode = 1;
});
