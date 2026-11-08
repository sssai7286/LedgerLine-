const app       = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`LedgerLine API running → http://localhost:${PORT}`);
    console.log(`API Docs            → http://localhost:${PORT}/api/docs`);
    console.log(`Health check        → http://localhost:${PORT}/api/health`);
  });
});
