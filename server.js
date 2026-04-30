require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const stkpushRoute = require('./routes/stkpush');
const callbackRoute = require('./routes/callback');
const statusRoute = require('./routes/status');
const errorHandler = require('./middleware/errorHandler');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'HustleHub M-Pesa Backend',
    version: '1.0.0',
    endpoints: {
      stkpush: 'POST /stkpush',
      callback: 'POST /callback',
      status: 'GET /payment-status/:id'
    }
  });
});

app.use('/stkpush', stkpushRoute);
app.use('/callback', callbackRoute);
app.use('/payment-status', statusRoute);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} not found` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log(`  POST http://localhost:${PORT}/stkpush`);
  console.log(`  POST http://localhost:${PORT}/callback`);
  console.log(`  GET  http://localhost:${PORT}/payment-status/:id`);
});

module.exports = app;
