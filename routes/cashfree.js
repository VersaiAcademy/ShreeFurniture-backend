const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { Transaction, Cart, Order, DeliveryAddress, Product } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { recordCheckoutOrder } = require('../controllers/customerOrderController');

const router = express.Router();

/**
 * Cashfree PG Orders API Integration
 * 
 * Environment Variables Required:
 * - CASHFREE_APP_ID (Live App ID)
 * - CASHFREE_SECRET_KEY (Live Secret Key)
 * - FRONTEND_BASE_URL (comma-separated URLs, first one used)
 * - CASHFREE_WEBHOOK_SECRET (optional, defaults to CASHFREE_SECRET_KEY)
 */

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_BASE = 'https://api.cashfree.com/pg'; // LIVE API BASE - DO NOT CHANGE
const CASHFREE_WEBHOOK_SECRET = process.env.CASHFREE_WEBHOOK_SECRET || CASHFREE_SECRET_KEY;

// Validate configuration on startup
if (CASHFREE_APP_ID && CASHFREE_SECRET_KEY) {
  console.log('✅ Cashfree Configuration Loaded:', {
    apiBase: CASHFREE_API_BASE,
    hasAppId: !!CASHFREE_APP_ID,
    hasSecret: !!CASHFREE_SECRET_KEY,
    appIdPrefix: CASHFREE_APP_ID.substring(0, 10) + '...',
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'Not set'
  });
} else {
  console.warn('⚠️ Cashfree credentials not configured. Payment gateway will not work.');
}

/**
 * POST /api/cashfree/create
 * Creates a Cashfree PG Orders order and returns payment_session_id
 */
router.post('/create', async (req, res) => {
  try {
    // Validate configuration
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'Cashfree credentials not configured on server' 
      });
    }

    // Validate required fields
    const { amount, email, phone, customer_id, name } = req.body;
    if (!amount || !email || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: amount, email, and phone are required' 
      });
    }

    // Generate unique order ID
    const orderId = `cf_order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Get frontend base URL (comma-separated, pick first)
    let frontendBase = '';
    if (process.env.FRONTEND_BASE_URL) {
      const urls = process.env.FRONTEND_BASE_URL.split(',').map(u => u.trim()).filter(u => u);
      frontendBase = urls[0] || '';
    }
    
    // Fallback to default
    if (!frontendBase) {
      frontendBase = 'https://shree-furniture-versai.vercel.app';
    }

    // Normalize frontend URL (remove trailing slashes)
    frontendBase = frontendBase.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(frontendBase)) {
      frontendBase = `https://${frontendBase}`;
    }
    if (frontendBase.startsWith('http://')) {
      frontendBase = frontendBase.replace(/^http:\/\//i, 'https://');
    }

    // Build return URL with order_id placeholder
    const returnUrl = `${frontendBase}/payment-success?order_id={order_id}`;

    // Build Cashfree PG Orders API payload
    const payload = {
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: 'INR',
      customer_details: {
        customer_id: String(customer_id || email || phone),
        customer_email: email,
        customer_phone: String(phone),
        customer_name: name || email.split('@')[0] || 'Customer'
      },
      order_meta: {
        return_url: returnUrl
      }
    };

    // Log configuration for debugging (without sensitive data)
    console.log('🔧 Cashfree Order Creation:', {
      orderId,
      amount: Number(amount),
      email,
      phone: phone ? `${phone.substring(0, 3)}***` : 'N/A',
      returnUrl,
      apiBase: CASHFREE_API_BASE,
      hasAppId: !!CASHFREE_APP_ID,
      hasSecret: !!CASHFREE_SECRET_KEY
    });

    // Cashfree PG Orders API endpoint
    const endpoint = `${CASHFREE_API_BASE}/orders`;
    
    // Required headers for PG Orders API
    const headers = {
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
      'x-api-version': '2022-09-01',
      'Content-Type': 'application/json'
    };

    // Create order via Cashfree PG Orders API
    const cfRes = await axios.post(endpoint, payload, { 
      headers,
      timeout: 30000 
    });
    
    const cfData = cfRes.data || {};

    // Extract payment_session_id (required for PG Orders Checkout)
    const paymentSessionId = cfData.payment_session_id ||
                             cfData.paymentSessionId ||
                             cfData.paymentSessionID ||
                             null;

    if (!paymentSessionId) {
      console.error('❌ Cashfree did not return payment_session_id:', cfData);
      return res.status(500).json({
        success: false,
        error: 'Cashfree did not return payment session ID',
        data: cfData
      });
    }

    // Return response with payment_session_id (frontend will use Cashfree JS SDK)
    return res.json({
      success: true,
      message: 'Cashfree order created successfully',
      orderId: orderId,
      payment_session_id: paymentSessionId,
      data: cfData
    });

  } catch (error) {
    console.error('❌ Cashfree create order error:', error.message);
    
    const cfData = error.response?.data || null;
    const statusCode = error.response?.status || 500;
    const errorMessage = 
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Cashfree order creation failed';

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: errorMessage,
      data: cfData
    });
  }
});

/**
 * POST /api/cashfree/webhook
 * Handles Cashfree webhook notifications
 */
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const signatureHeader = req.headers['x-webhook-signature'] || 
                           req.headers['x-api-signature'] || 
                           req.headers['x-client-signature'];

    const bodyBuffer = req.body;
    const bodyString = bodyBuffer instanceof Buffer ? 
                      bodyBuffer.toString('utf8') : 
                      JSON.stringify(req.body);

    // Verify webhook signature
    if (CASHFREE_WEBHOOK_SECRET && signatureHeader) {
      const computed = crypto
        .createHmac('sha256', CASHFREE_WEBHOOK_SECRET)
        .update(bodyString)
        .digest('hex');
      
      if (computed !== signatureHeader) {
        console.warn('⚠️ Cashfree webhook signature mismatch');
        return res.status(400).send('Invalid signature');
      }
    }

    // Parse webhook payload
    const payload = JSON.parse(bodyString);
    const { orderId, orderAmount, txStatus, referenceId, paymentMode } = payload;

    // Update transaction record
    const tx = await Transaction.findOne({ order_id: orderId });
    if (tx) {
      tx.payment_id = referenceId || tx.payment_id;
      tx.signature = payload.signature || tx.signature || '';
      tx.amount = Number(orderAmount || tx.amount);
      tx.status = txStatus || tx.status;
      await tx.save();
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Cashfree webhook error:', err);
    res.status(500).send('Webhook processing error');
  }
});

/**
 * POST /api/cashfree/verify
 * Verifies payment status and creates order in system
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ 
        message: 'orderId is required' 
      });
    }

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(500).json({ 
        message: 'Cashfree not configured on server' 
      });
    }

    // Verify order status with Cashfree
    const headers = {
      'Content-Type': 'application/json',
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
      'x-api-version': '2022-09-01'
    };

    const statusEndpoint = `${CASHFREE_API_BASE}/orders/${orderId}`;
    const cfStatus = await axios.get(statusEndpoint, { 
      headers, 
      timeout: 10000 
    });

    const orderInfo = cfStatus.data || {};
    
    // Check payment status
    const status = orderInfo.order_status || 
                   orderInfo.payment_status || 
                   orderInfo.status ||
                   orderInfo.txStatus || 
                   orderInfo.orderStatus ||
                   '';
    
    const paymentStatus = orderInfo.payment?.payment_status || 
                         orderInfo.payment?.status ||
                         orderInfo.payments?.[0]?.payment_status ||
                         null;

    const finalStatus = paymentStatus || status;
    const isSuccess = finalStatus && /SUCCESS|PAID|COMPLETED|ACTIVE/i.test(finalStatus);
    
    if (!isSuccess) {
      return res.status(400).json({ 
        message: 'Payment not completed', 
        status: finalStatus || 'unknown', 
        data: orderInfo,
        orderId 
      });
    }

    // Payment succeeded - create orders
    const userId = req.user._id;
    const addressId = req.body.addressId;
    
    const deliveryAddress = await DeliveryAddress.findOne({ 
      _id: addressId, 
      user: userId 
    });
    
    if (!deliveryAddress) {
      return res.status(404).json({ 
        message: 'Address not found' 
      });
    }

    // Get cart items
    const cartItems = await Cart.find({ user: userId }).populate('product');
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ 
        message: 'Cart is empty' 
      });
    }

    // Create order
    const orderIdLocal = `ORD-${Date.now()}-${uuidv4().substring(0,8).toUpperCase()}`;
    const orders = [];
    const total = req.body.total || cartItems.reduce((s, c) => {
      const price = c.product.price - (c.product.price * (c.product.offer || 0) / 100);
      return s + price * (c.qty || 1);
    }, 0);

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

      // Decrement stock
      await Product.findByIdAndUpdate(cartItem.product._id, { 
        $inc: { stock_count: -(cartItem.qty || 1) } 
      });
    }

    // Clear cart
    await Cart.deleteMany({ user: userId });

    const cartSummary = {
      total,
      productName:
        cartItems.length === 1
          ? cartItems[0].product?.pname || cartItems[0].product_name || 'Order Item'
          : `${cartItems.length} items`,
      productId: cartItems.length === 1 ? String(cartItems[0].product?._id || cartItems[0].product || '') : undefined,
      items: cartItems.map((item) => ({
        productId: String(item.product?._id || item.product || ''),
        productName: item.product?.pname || item.product_name || 'Product',
        quantity: item.qty || 1,
        price: item.product?.price || item.price || 0
      })),
      legacyIds: orders.map((o) => o._id)
    };

    let snapshot = null;
    try {
      snapshot = await recordCheckoutOrder({
        user: req.user,
        address: deliveryAddress,
        cartSummary,
        paymentMode: 'online',
        paymentStatus: 'paid',
        orderId: orderIdLocal
      });
    } catch (notifyErr) {
      console.warn('Failed to record online order snapshot', notifyErr.message);
    }

    res.status(200).json({ 
      message: 'Order created after payment', 
      orders, 
      orderId: orderIdLocal,
      orderSummary: snapshot 
    });
  } catch (err) {
    console.error('❌ Verify order error:', err);
    res.status(500).json({ 
      message: 'Failed to verify/create order', 
      error: err.message 
    });
  }
});

module.exports = router;
