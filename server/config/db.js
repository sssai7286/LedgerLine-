const { Pool, types } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

types.setTypeParser(20, Number);

const connectionString = process.env.NODE_ENV === 'test'
  ? process.env.DATABASE_TEST_URL || process.env.DATABASE_URL
  : process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: true }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err.message);
});

const connectDB = async () => {
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set to connect to PostgreSQL');
  }

  await pool.query('SELECT 1');
  console.log('PostgreSQL connected');

  const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database schema applied');
};

module.exports = { pool, connectDB };
