const express = require('express');
const router = express.Router();
const mpesaService = require('../services/mpesaService');

router.get('/:checkoutRequestId', async (req, res) => {
  console.log('\n--- Frontend polling for status ---');
  console.log('CheckoutRequestID:', req.params.checkoutRequestId);

  try {
    const result = await mpesaService.checkPaymentStatus(req.params.checkoutRequestId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
