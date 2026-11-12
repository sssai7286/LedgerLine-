const { pool, connectDB } = require('../config/db');

beforeAll(async () => {
  if (!process.env.DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL must point to a dedicated PostgreSQL test database');
  }
  await connectDB();
});

afterEach(async () => {
  await pool.query(
    'TRUNCATE TABLE audit_logs, journal_entries, transactions, accounts, users RESTART IDENTITY CASCADE'
  );
});

afterAll(async () => {
  await pool.end();
});
