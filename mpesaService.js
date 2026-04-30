const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Store pending transactions in memory (use Redis/DB in production)
const pendingTransactions = new Map();

class MpesaService {
  constructor() {
    this.baseUrl = process.env.MPESA_ENV === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
  }

  // Generate access token from Safaricom
  async getAccessToken() {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Token generation error:', error.response?.data || error.message);
      throw new Error('Failed to generate M-Pesa access token');
    }
  }

  // Generate timestamp in format YYYYMMDDHHmmss
  getTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  // Generate password (base64 of shortcode + passkey + timestamp)
  getPassword(timestamp) {
    const shortCode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const password = `${shortCode}${passkey}${timestamp}`;

    return Buffer.from(password).toString('base64');
  }

  // Format phone number to 2547XXXXXXXX
  formatPhone(phone) {
    let formatted = phone.replace(/\s/g, '');

    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.slice(1);
    } else if (formatted.startsWith('+')) {
      formatted = formatted.slice(1);
    }

    return formatted;
  }

  // Send STK Push
  async sendSTKPush({ phone, amount, userId, description }) {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.getPassword(timestamp);
      const formattedPhone = this.formatPhone(phone);
      const shortCode = process.env.MPESA_SHORTCODE;
      const callbackUrl = process.env.MPESA_CALLBACK_URL;

      const payload = {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: 'HustleHubPro',
        TransactionDesc: description || 'Premium Subscription'
      };

      console.log('Sending STK Push:', { phone: formattedPhone, amount });

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data;

      // Store transaction for polling
      if (data.CheckoutRequestID) {
        pendingTransactions.set(data.CheckoutRequestID, {
          userId,
          phone: formattedPhone,
          amount,
          status: 'pending',
          createdAt: new Date().toISOString(),
          merchantRequestId: data.MerchantRequestID
        });
      }

      return {
        success: true,
        data: {
          checkoutRequestId: data.CheckoutRequestID,
          merchantRequestId: data.MerchantRequestID,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription,
          customerMessage: data.CustomerMessage
        }
      };
    } catch (error) {
      console.error('STK Push error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.errorMessage || error.message
      };
    }
  }

  // Handle callback from Safaricom
  async handleCallback(callbackData) {
    console.log('Processing callback:', JSON.stringify(callbackData, null, 2));

    try {
      const body = callbackData.Body?.stkCallback || callbackData;
      const resultCode = body.ResultCode;
      const checkoutRequestId = body.CheckoutRequestID;

      const transaction = pendingTransactions.get(checkoutRequestId);

      if (resultCode === 0) {
        // Payment successful
        const metadata = body.CallbackMetadata?.Item || [];
        const amountPaid = metadata.find(item => item.Name === 'Amount')?.Value;
        const mpesaReceipt = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
        const phone = metadata.find(item => item.Name === 'PhoneNumber')?.Value;

        // Update in memory
        if (transaction) {
          transaction.status = 'success';
          transaction.mpesaReceipt = mpesaReceipt;
          transaction.amountPaid = amountPaid;
          pendingTransactions.set(checkoutRequestId, transaction);
        }

        // Save to Supabase
        await this.savePaymentToSupabase({
          user_id: transaction?.userId || 'unknown',
          phone: phone || transaction?.phone,
          amount: amountPaid || transaction?.amount,
          status: 'completed',
          checkout_request_id: checkoutRequestId,
          mpesa_receipt: mpesaReceipt,
          created_at: new Date().toISOString()
        });

        return { status: 'success', message: 'Payment processed successfully' };
      } else {
        // Payment failed
        if (transaction) {
          transaction.status = 'failed';
          transaction.failureReason = body.ResultDesc;
          pendingTransactions.set(checkoutRequestId, transaction);
        }

        return { status: 'failed', message: body.ResultDesc };
      }
    } catch (error) {
      console.error('Callback processing error:', error);
      return { status: 'error', message: error.message };
    }
  }

  // Check payment status (for frontend polling)
  async checkPaymentStatus(checkoutRequestId) {
    const transaction = pendingTransactions.get(checkoutRequestId);

    if (!transaction) {
      return { status: 'not_found', message: 'Transaction not found' };
    }

    return {
      status: transaction.status,
      data: {
        checkoutRequestId,
        amount: transaction.amount,
        phone: transaction.phone,
        mpesaReceipt: transaction.mpesaReceipt,
        failureReason: transaction.failureReason
      }
    };
  }

  // Save payment to Supabase
  async savePaymentToSupabase(paymentData) {
    try {
      const { error } = await supabase
        .from('payments')
        .insert([paymentData]);

      if (error) throw error;
      console.log('Payment saved to Supabase');
    } catch (error) {
      console.error('Supabase save error:', error);
    }
  }
}

module.exports = new MpesaService();
