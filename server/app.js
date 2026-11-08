require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes        = require('./routes/authRoutes');
const accountRoutes     = require('./routes/accountRoutes');
const ledgerRoutes      = require('./routes/ledgerRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const auditRoutes       = require('./routes/auditRoutes');

// Swagger
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

const app = express();

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
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', db: 'mongodb', timestamp: new Date().toISOString() })
);

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
