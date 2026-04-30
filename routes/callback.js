const express = require('express');
const router = express.Router();
const mpesaService = require('../services/mpesaService');

router.post('/', async (req, res) => {
  console.log('\n========================================');
  console.log('📩 CALLBACK FROM SAFARICOM RECEIVED');
  console.log('========================================');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  try {
    // Process the callback (save to database, unlock premium, etc.)
    const result = await mpesaService.handleCallback(req.body);

    console.log('\n✅ Callback processed. Result:', result.status);

    // CRITICAL: Always return 200 OK to Safaricom
    // If we return an error, Safaricom will retry and may block our URL
    res.status(200).json({
      status: 'ok',
      processed: true,
      result: result.status
    });

  } catch (error) {
    console.error('❌ Callback processing error:', error);

    // EVEN ON ERROR: Return 200 OK to prevent Safaricom retries
    // We log the error internally but tell Safaricom everything is fine
    res.status(200).json({
      status: 'error_logged',
      message: 'Error was logged but acknowledged to Safaricom'
    });
  }
});

router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Callback endpoint is active. Safaricom will POST here after payment.',
    note: 'This endpoint receives payment results from Safaricom automatically.'
  });
});

module.exports = router;
