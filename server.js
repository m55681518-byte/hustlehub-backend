const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'HustleHub API is running', timestamp: new Date().toISOString() });
});

// M-Pesa STK Push
app.post('/api/mpesa/stkpush', async (req, res) => {
  const { phoneNumber, amount, accountReference, transactionDesc } = req.body;
  
  console.log('STK Push requested:', { phoneNumber, amount });
  
  res.json({
    ResponseCode: '0',
    ResponseDescription: 'Success. Request accepted for processing',
    CheckoutRequestID: 'ws_' + Date.now(),
    MerchantRequestID: 'test_' + Date.now()
  });
});

// M-Pesa Callback
app.post('/api/mpesa/callback', (req, res) => {
  console.log('M-Pesa Callback received:', req.body);
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Payment status check
app.get('/api/status', (req, res) => {
  res.json({ isPremium: true, phone: req.query.phone });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});