require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const authRoutes        = require('./routes/authRoutes');
const accountRoutes     = require('./routes/accountRoutes');
const ledgerRoutes      = require('./routes/ledgerRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const auditRoutes       = require('./routes/auditRoutes');

// Swagger
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');
const { pool }    = require('./config/db');
const { asyncHandler } = require('./middleware/auth');

const app = express();

if (process.env.NODE_ENV !== 'production') {
  app.set('trust proxy', 'loopback');
}

// ── Security ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '10kb' }));

// Rate limiters (skip in test env)
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 100,
    message: { error: 'Too many requests' } }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20,
    message: { error: 'Too many auth attempts' } }));
}

// ── API Docs ──────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/accounts',     accountRoutes);
app.use('/api/ledger',       ledgerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/audit',        auditRoutes);

// ── Health ────────────────────────────────────────────────────────
app.get('/api/health', asyncHandler(async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'postgresql', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Database health check failed:', err.message);
    res.status(503).json({ status: 'error', db: 'postgresql', timestamp: new Date().toISOString() });
  }
}));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
