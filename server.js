require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint (Render uses this)
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'HustleHub M-Pesa Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check for Render
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Import routes
try {
  const stkpushRoute = require('./routes/stkpush');
  const callbackRoute = require('./routes/callback');
  const statusRoute = require('./routes/status');

  app.use('/stkpush', stkpushRoute);
  app.use('/callback', callbackRoute);
  app.use('/payment-status', statusRoute);

  console.log('✅ Routes loaded successfully');
} catch (err) {
  console.error('❌ Failed to load routes:', err.message);
  console.error('Make sure routes/ folder exists with stkpush.js, callback.js, status.js');
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
