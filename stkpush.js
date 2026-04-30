const express = require('express');
const router = express.Router();
const mpesaService = require('../services/mpesaService');

router.post('/', async (req, res) => {
  console.log('STK Push request received:', req.body);
  try {
    const { phone, amount, userId, description } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });
    if (!amount) return res.status(400).json({ success: false, message: 'Amount required' });
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    const result = await mpesaService.sendSTKPush({ phone, amount, userId, description });
    res.status(200).json(result);
  } catch (error) {
    console.error('STK Push route error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
