const express = require('express');
const { body, validationResult } = require('express-validator');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Transaction } = require('../models');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret'
});

// Create Razorpay order
router.post('/create', [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').optional().isString().withMessage('Currency must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array(),
        status: 400
      });
    }

    const { amount, currency = 'INR' } = req.body;

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      message: 'Order created successfully',
      data: order,
      status: 200
    });

  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({
      message: 'Something went wrong while creating order',
      status: 500
    });
  }
});

// Verify payment and create transaction
router.post('/complete', [
  body('order_id').notEmpty().withMessage('Order ID is required'),
  body('payment_id').notEmpty().withMessage('Payment ID is required'),
  body('signature').notEmpty().withMessage('Signature is required'),
  body('amount').isNumeric().withMessage('Amount must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array(),
        status: 400
      });
    }

    const { order_id, payment_id, signature, amount } = req.body;

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret')
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({
        message: 'Invalid signature',
        status: 400
      });
    }

    // Create transaction record
    const transaction = new Transaction({
      payment_id,
      order_id,
      signature,
      amount
    });

    await transaction.save();

    res.status(201).json({
      message: 'Success, transaction created',
      transaction,
      status: 201
    });

  } catch (error) {
    console.error('Transaction creation error:', error);
    res.status(500).json({
      message: 'Something went wrong while creating transaction',
      status: 500
    });
  }
});

// Get payment details
router.get('/payment/:payment_id', async (req, res) => {
  try {
    const { payment_id } = req.params;

    const payment = await razorpay.payments.fetch(payment_id);

    res.status(200).json({
      payment,
      status: 200
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching payment',
      status: 500
    });
  }
});

// Get order details
router.get('/order/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;

    const order = await razorpay.orders.fetch(order_id);

    res.status(200).json({
      order,
      status: 200
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching order',
      status: 500
    });
  }
});

module.exports = router;
