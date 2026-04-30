const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with NEW credentials
const supabaseUrl = process.env.SUPABASE_URL || 'https://hcriatxprcifgwfqokbw.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set in .env');
    console.error('Please add your service_role key to .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Store pending transactions in memory
const pendingTransactions = new Map();

class MpesaService {
    constructor() {
        this.baseUrl = process.env.MPESA_ENV === 'production' 
            ? 'https://api.safaricom.co.ke' 
            : 'https://sandbox.safaricom.co.ke';
    }

    async getAccessToken() {
        const consumerKey = process.env.MPESA_CONSUMER_KEY;
        const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

        if (!consumerKey || !consumerSecret) {
            throw new Error('M-Pesa credentials not configured');
        }

        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

        try {
            const response = await axios.get(
                `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
                { headers: { Authorization: `Basic ${auth}` } }
            );
            return response.data.access_token;
        } catch (error) {
            console.error('Token generation error:', error.response?.data || error.message);
            throw new Error('Failed to generate M-Pesa access token');
        }
    }

    getTimestamp() {
        const date = new Date();
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
    }

    getPassword(timestamp) {
        const shortCode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;
        return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
    }

    formatPhone(phone) {
        let formatted = phone.replace(/\s/g, '');
        if (formatted.startsWith('0')) formatted = '254' + formatted.slice(1);
        else if (formatted.startsWith('+')) formatted = formatted.slice(1);
        return formatted;
    }

    async sendSTKPush({ phone, amount, userId, description }) {
        try {
            // Validate userId is a real UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!userId || !uuidRegex.test(userId)) {
                return {
                    success: false,
                    message: 'Invalid user ID. User must be authenticated.'
                };
            }

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

            console.log('Sending STK Push:', { phone: formattedPhone, amount, userId });

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

    async handleCallback(callbackData) {
        console.log('Processing callback:', JSON.stringify(callbackData, null, 2));

        try {
            const body = callbackData.Body?.stkCallback || callbackData;
            const resultCode = body.ResultCode;
            const checkoutRequestId = body.CheckoutRequestID;

            const transaction = pendingTransactions.get(checkoutRequestId);

            if (resultCode === 0) {
                const metadata = body.CallbackMetadata?.Item || [];
                const amountPaid = metadata.find(item => item.Name === 'Amount')?.Value;
                const mpesaReceipt = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
                const phone = metadata.find(item => item.Name === 'PhoneNumber')?.Value;

                if (transaction) {
                    transaction.status = 'success';
                    transaction.mpesaReceipt = mpesaReceipt;
                    transaction.amountPaid = amountPaid;
                    pendingTransactions.set(checkoutRequestId, transaction);
                }

                // Save to Supabase with REAL user_id (UUID)
                const userId = transaction?.userId;
                if (userId) {
                    await this.savePaymentToSupabase({
                        user_id: userId,
                        phone: phone || transaction?.phone,
                        amount: amountPaid || transaction?.amount,
                        status: 'completed',
                        checkout_request_id: checkoutRequestId,
                        mpesa_receipt: mpesaReceipt,
                        created_at: new Date().toISOString()
                    });
                } else {
                    console.error('No userId found for transaction:', checkoutRequestId);
                }

                return { status: 'success', message: 'Payment processed successfully' };
            } else {
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

    async savePaymentToSupabase(paymentData) {
        try {
            const { data, error } = await supabase
                .from('payments')
                .insert([paymentData])
                .select();

            if (error) {
                console.error('Supabase insert error:', error);
                throw error;
            }
            console.log('Payment saved to Supabase:', data);
        } catch (error) {
            console.error('Supabase save error:', error.message);
        }
    }
}

module.exports = new MpesaService();
