const { pool, connectDB } = require('../config/db');

beforeAll(async () => {
  if (!process.env.DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL must point to a dedicated PostgreSQL test database');
  }
  await connectDB();
});

afterEach(async () => {
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
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await pool.end();
});
