const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { Transaction, Cart, Order, DeliveryAddress, Product } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * NOTE: This file provides a safe, configurable template for integrating Cashfree.
 * You MUST set these environment variables in `backend/.env` (do NOT commit secrets):
 * - CASHFREE_APP_ID
 * - CASHFREE_SECRET_KEY
 * - CASHFREE_API_BASE (must be exactly https://api.cashfree.com/pg)
 * - CASHFREE_WEBHOOK_SECRET (if you use a separate webhook secret)
 */

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const REQUIRED_CASHFREE_BASE = 'https://api.cashfree.com/pg';
const DEFAULT_FRONTEND_URL = (process.env.DEFAULT_FRONTEND_URL || 'https://shree-furniture-versai.vercel.app').replace(/\/+$/, '');
const rawCashfreeBase = (process.env.CASHFREE_API_BASE || '').trim();
const normalizedCashfreeBase = rawCashfreeBase.replace(/\/+$/, '');
let CASHFREE_API_BASE = normalizedCashfreeBase || REQUIRED_CASHFREE_BASE;

if (!rawCashfreeBase) {
  console.warn(`⚠️ CASHFREE_API_BASE missing. Defaulting to LIVE base ${REQUIRED_CASHFREE_BASE}`);
}

if (CASHFREE_API_BASE !== REQUIRED_CASHFREE_BASE) {
  console.error(`❌ CASHFREE_API_BASE must be exactly ${REQUIRED_CASHFREE_BASE}. Received: ${CASHFREE_API_BASE}. Forcing LIVE base.`);
  CASHFREE_API_BASE = REQUIRED_CASHFREE_BASE;
}

const CASHFREE_WEBHOOK_SECRET = process.env.CASHFREE_WEBHOOK_SECRET || CASHFREE_SECRET_KEY;

const logCashfreeConfig = () => {
  console.log('💡 Cashfree config check:', {
    baseUrl: CASHFREE_API_BASE,
    hasAppId: !!CASHFREE_APP_ID,
    hasSecret: !!CASHFREE_SECRET_KEY
  });
};
logCashfreeConfig();

// Debug endpoint - non-sensitive: reports whether Cashfree env vars are present (no values)
router.get('/config', (req, res) => {
  try {
    return res.json({
      configured: !!CASHFREE_APP_ID && !!CASHFREE_SECRET_KEY,
      hasAppId: !!CASHFREE_APP_ID,
      hasSecretKey: !!CASHFREE_SECRET_KEY,
      apiBase: CASHFREE_API_BASE
    });
  } catch (err) {
    return res.status(500).json({ error: 'config check failed' });
  }
});

router.post('/create', async (req, res) => {
  try {
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(500).json({ success: false, error: 'Cashfree not configured on server' });
    }

    const { amount, email, phone, customer_id } = req.body;
    if (!amount || !email || !phone) {
      return res.status(400).json({ success: false, error: 'Missing required fields (amount, email, phone)' });
    }

    const orderId = `cf_order_${Date.now()}`;

    const pickFrontendBase = (value) => {
      if (!value || typeof value !== 'string') return '';
      const firstPipe = value.split('||')[0];
      const firstComma = firstPipe.split(',')[0];
      return firstComma.trim();
    };

    let frontendBase = pickFrontendBase(process.env.FRONTEND_BASE_URL);
    if (!frontendBase && req.headers.origin) {
      frontendBase = req.headers.origin.split(',')[0].trim();
    }
    if (!frontendBase) {
      frontendBase = DEFAULT_FRONTEND_URL;
    }

    frontendBase = frontendBase.trim();

    if (!/^https?:\/\//i.test(frontendBase)) {
      frontendBase = `https://${frontendBase}`;
    }

    if (frontendBase.startsWith('http://')) {
      frontendBase = frontendBase.replace(/^http:\/\//i, 'https://');
    }

    frontendBase = frontendBase.replace(/\/+$/, '') || DEFAULT_FRONTEND_URL;
    console.log('↩️ Cashfree return_url origin:', frontendBase, '| env:', process.env.FRONTEND_BASE_URL, '| origin header:', req.headers.origin);

    const payload = {
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: 'INR',
      customer_details: {
        customer_id: String(customer_id || email || phone),
        customer_email: email,
        customer_phone: String(phone),
      },
      order_meta: {
        return_url: `${frontendBase}/payment-success?order_id=${orderId}`,
      },
    };

    const endpoint = `${CASHFREE_API_BASE}/orders`;
    const headers = {
      'x-client-id': process.env.CASHFREE_APP_ID,
      'x-client-secret': process.env.CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json',
    };

    console.log('🔗 Final URL:', endpoint);
    console.log('🧾 Headers:', { hasId: !!headers['x-client-id'], hasSecret: !!headers['x-client-secret'], apiVersion: headers['x-api-version'] });
    console.log('📤 Request Body:', payload);

    const cfRes = await axios.post(endpoint, payload, { headers });
    const cfData = cfRes.data || {};

    const paymentLink = cfData.payment_link ||
                        cfData.paymentUrl ||
                        cfData.payment_url ||
                        cfData.checkout_url ||
                        cfData.checkoutUrl ||
                        cfData.order_meta?.payment_link ||
                        null;

    const paymentSessionId = cfData.payment_session_id ||
                             cfData.paymentSessionId ||
                             cfData.paymentSessionID ||
                             null;

    let constructedPaymentLink = paymentLink;
    if (!constructedPaymentLink && paymentSessionId) {
      constructedPaymentLink = `https://payments.cashfree.com/forms/${paymentSessionId}`;
    }

    return res.json({
      success: true,
      message: 'Cashfree order created',
      orderId,
      data: cfData,
      payment_link: constructedPaymentLink,
      payment_session_id: paymentSessionId,
    });

  } catch (error) {
    console.log('❌ Cashfree Create Order Failed');
    if (error.response) {
      console.log('🔍 Cashfree Response Error:', error.response.data);
    } else {
      console.log('🔍 Cashfree Error:', error.message);
    }

    const cfData = error.response?.data || null;
    const msg =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Cashfree order creation failed';

    return res.status(error.response?.status || 500).json({
      success: false,
      message: msg,
      data: cfData,
    });
  }
});

// Webhook endpoint: Cashfree will POST payment updates here
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // Cashfree sends a signature header (name may differ per docs) - common header used: 'x-api-signature' or 'x-webhook-signature'
    const signatureHeader = req.headers['x-webhook-signature'] || req.headers['x-api-signature'] || req.headers['x-client-signature'];

    const bodyBuffer = req.body;
    const bodyString = bodyBuffer instanceof Buffer ? bodyBuffer.toString('utf8') : JSON.stringify(req.body);

    // Verify signature using HMAC SHA256 with your webhook secret
    if (CASHFREE_WEBHOOK_SECRET && signatureHeader) {
      const computed = crypto.createHmac('sha256', CASHFREE_WEBHOOK_SECRET).update(bodyString).digest('hex');
      if (computed !== signatureHeader) {
        console.warn('Cashfree webhook signature mismatch');
        return res.status(400).send('Invalid signature');
      }
    }

    // Parse the webhook payload
    const payload = JSON.parse(bodyString);
    console.log('Cashfree webhook payload:', payload);

    // Update transaction record based on payload (adjust field names per Cashfree payload)
    const { orderId, orderAmount, txStatus, referenceId, paymentMode } = payload;

    const tx = await Transaction.findOne({ order_id: orderId });
    if (tx) {
      tx.payment_id = referenceId || tx.payment_id;
      tx.signature = payload.signature || tx.signature || '';
      tx.amount = Number(orderAmount || tx.amount);
      await tx.save();
    }

    // Respond 200 to acknowledge webhook
    res.status(200).send('OK');
  } catch (err) {
    console.error('Cashfree webhook error:', err);
    res.status(500).send('Webhook processing error');
  }
});

// Verify order status and create order in our system (called by frontend after redirect)
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: 'orderId required' });

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(500).json({ message: 'Cashfree not configured on server' });
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY
    };

    const statusEndpoint = `${CASHFREE_API_BASE}/orders/${orderId}`;
    console.log('🔍 Checking payment status for order:', orderId, 'at:', statusEndpoint);
    
    const cfStatus = await axios.get(statusEndpoint, { headers, timeout: 10000 });

    // Cashfree returns order/payment info; check for successful payment
    const orderInfo = cfStatus.data || {};
    console.log('📦 Cashfree order status response:', JSON.stringify(orderInfo).substring(0, 500));
    
    // Cashfree v2 API response fields (check multiple possible field names)
    const status = orderInfo.order_status || 
                   orderInfo.payment_status || 
                   orderInfo.status ||
                   orderInfo.txStatus || 
                   orderInfo.orderStatus ||
                   '';
    
    // Also check payment object if nested
    const paymentStatus = orderInfo.payment?.payment_status || 
                         orderInfo.payment?.status ||
                         orderInfo.payments?.[0]?.payment_status ||
                         null;

    const finalStatus = paymentStatus || status;
    
    console.log('✅ Payment status:', finalStatus, '| Original status:', status);

    // Check if payment is successful (Cashfree uses various status values)
    const isSuccess = finalStatus && /SUCCESS|PAID|COMPLETED|ACTIVE/i.test(finalStatus);
    
    if (!isSuccess) {
      console.warn('⚠️ Payment not completed. Status:', finalStatus || 'unknown', 'Order:', orderId);
      return res.status(400).json({ 
        message: 'Payment not completed', 
        status: finalStatus || 'unknown', 
        data: orderInfo,
        orderId 
      });
    }
    
    console.log('✅ Payment verified successfully for order:', orderId);

    // Payment succeeded — create orders just like /api/orders does
    const userId = req.user._id;

    // Verify address exists
    const addressId = req.body.addressId;
    const deliveryAddress = await DeliveryAddress.findOne({ _id: addressId, user: userId });
    if (!deliveryAddress) return res.status(404).json({ message: 'Address not found' });

    // Get cart items
    const cartItems = await Cart.find({ user: userId }).populate('product');
    if (!cartItems || cartItems.length === 0) return res.status(400).json({ message: 'Cart empty' });

    const orderIdLocal = `ORD-${Date.now()}-${uuidv4().substring(0,8).toUpperCase()}`;
    const orders = [];
    const total = req.body.total || cartItems.reduce((s, c) => s + (c.product.price - (c.product.price * (c.product.offer||0)/100)) * (c.qty||1), 0);

    for (const cartItem of cartItems) {
      const order = new Order({
        product: cartItem.product._id,
        order_id: orderIdLocal,
        user: userId,
        address: addressId,
        total: total,
        mode: 'online'
      });
      await order.save();
      orders.push(order);

      // decrement stock
      await Product.findByIdAndUpdate(cartItem.product._id, { $inc: { stock_count: - (cartItem.qty || 1) } });
    }

    // Clear cart
    await Cart.deleteMany({ user: userId });

    res.status(200).json({ message: 'Order created after payment', orders, orderId: orderIdLocal });
  } catch (err) {
    console.error('Verify/Create order error:', err.response?.data || err.message || err);
    res.status(500).json({ message: 'Failed to verify/create order', error: err.message });
  }
});

module.exports = router;