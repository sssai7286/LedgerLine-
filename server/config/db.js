const mongoose = require('mongoose');
const dns      = require('dns');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('❌  MONGO_URI is not set in .env');
    process.exit(1);
  }

  // ── DNS fix ────────────────────────────────────────────────────
  // The local DNS resolver (172.16.0.1) cannot resolve MongoDB Atlas
  // SRV records (_mongodb._tcp.<host>), which are required by the
  // mongodb+srv:// scheme.  Cloudflare (1.1.1.1) and Google (8.8.8.8)
  // resolve them correctly.  Setting these servers here makes Node's
  // built-in DNS module (used by the MongoDB driver for SRV lookups)
  // bypass the broken local resolver — no system-level change needed.
  dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1']);

  try {
    const conn = await mongoose.connect(uri, {
      // Increase the server-selection timeout so a slow first lookup
      // has time to succeed before we give up.
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS:          10000,
    });
    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    console.error('');
    console.error('    Diagnostics:');
    console.error('    • MONGO_URI cluster: check .env');
    console.error('    • Ensure your IP is whitelisted in Atlas → Network Access');
    console.error('    • Or set 0.0.0.0/0 in Atlas for development');
    process.exit(1);
  }
};

module.exports = connectDB;
