const app = require('./app');
const { pool, connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`LedgerLine API running at http://localhost:${PORT}`);
      console.log(`API Docs            http://localhost:${PORT}/api/docs`);
      console.log(`Health check        http://localhost:${PORT}/api/health`);
    });

    const shutdown = () => {
      server.close(() => {
        pool.end().then(() => process.exit(0));
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (err) {
    console.error('Unable to start LedgerLine API:', err.message);
    await pool.end();
    process.exitCode = 1;
  }
};

start();
