require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const authRoutes        = require('./routes/authRoutes');
const accountRoutes     = require('./routes/accountRoutes');
const ledgerRoutes      = require('./routes/ledgerRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const auditRoutes       = require('./routes/auditRoutes');

// Connect to MongoDB
connectDB();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '10kb' }));

// Rate limiter — 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Stricter limiter on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later' },
});
app.use('/api/auth', authLimiter);

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/accounts',     accountRoutes);
app.use('/api/ledger',       ledgerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/audit',        auditRoutes);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', db: 'mongodb', timestamp: new Date().toISOString() })
);

// ── 404 handler ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`LedgerLine API running on http://localhost:${PORT}`);
});
