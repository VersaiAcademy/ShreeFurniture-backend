const { validationResult } = require('express-validator');
const CustomerOrder = require('../models/CustomerOrder');
const sendMail = require('../utils/sendMail');
const { buildAdminOrderEmail, buildCustomerOrderEmail } = require('../utils/emailTemplates');
const { getAdminEmail } = require('../config/emailConfig');

const ADMIN_EMAIL = getAdminEmail();

const generateOrderId = (prefix = 'ORD') => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${Date.now()}-${random}`;
};

const sanitizePhone = (phone = '') => phone.replace(/[^\d+]/g, '').substring(0, 15);

const createOrderRecord = async (payload = {}) => {
  const orderId = payload.orderId || generateOrderId(payload.formType === 'checkout' ? 'CHK' : 'ORD');
  const baseData = {
    ...payload,
    orderId,
    phone: sanitizePhone(payload.phone),
    paymentStatus: payload.paymentStatus || (payload.paymentMode === 'online' ? 'paid' : 'cod')
  };
  const order = await CustomerOrder.create(baseData);
  return order;
};

const { buildCustomFurnitureEmail, buildBulkOrderEmail } = require('../utils/emailTemplates');

const dispatchEmails = async (order) => {
  if (!ADMIN_EMAIL) {
    console.warn('⚠️ ADMIN_EMAIL not configured. Skipping admin notification.');
    return;
  }

  try {
    console.log(`📧 Preparing to send order emails for order: ${order.orderId}`);
    console.log(`📧 Admin email: ${ADMIN_EMAIL}`);
    console.log(`📧 Customer email: ${order.email || 'Not provided'}`);
    console.log(`📧 Form type: ${order.formType}`);

    // Choose appropriate email template based on form type
    let adminHtml;
    if (order.formType === 'custom') {
      adminHtml = buildCustomFurnitureEmail(order);
    } else if (order.formType === 'bulk') {
      adminHtml = buildBulkOrderEmail(order);
    } else {
      adminHtml = buildAdminOrderEmail(order);
    }

    const customerHtml = buildCustomerOrderEmail(order);

    const operations = [
      sendMail({
        to: ADMIN_EMAIL,
        subject: `New ${order.formType === 'custom' ? 'Custom Furniture' : order.formType === 'bulk' ? 'Bulk Order' : 'Order'} Received - ${order.orderId}`,
        html: adminHtml
      })
    ];

    // Send customer confirmation email if email is provided
    if (order.email) {
      operations.push(
        sendMail({
          to: order.email,
          subject: `Order Confirmation - ${order.orderId} | SRI Furniture Village`,
          html: customerHtml
        })
      );
    }

    const results = await Promise.allSettled(operations);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const recipient = index === 0 ? ADMIN_EMAIL : order.email;
        console.error(`❌ Email dispatch failed for ${recipient}:`, result.reason?.message || result.reason);
        console.error('❌ Full error:', result.reason);
      } else {
        const recipient = index === 0 ? ADMIN_EMAIL : order.email;
        console.log(`✅ Email sent successfully to ${recipient}`);
      }
    });
  } catch (error) {
    console.error('❌ Error in dispatchEmails:', error);
    // Don't throw - email failure shouldn't break order creation
  }
};

exports.createPublicOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Additional validation for phone and pincode
    const phoneStr = String(req.body.phone || '').replace(/\D/g, '');
    if (phoneStr.length !== 10) {
      return res.status(422).json({
        success: false,
        message: 'Phone number must be exactly 10 digits',
        errors: [{ param: 'phone', msg: 'Phone number must be exactly 10 digits' }]
      });
    }

    const pincodeStr = String(req.body.pincode || '').replace(/\D/g, '');
    if (pincodeStr.length !== 6) {
      return res.status(422).json({
        success: false,
        message: 'Pincode must be exactly 6 digits',
        errors: [{ param: 'pincode', msg: 'Pincode must be exactly 6 digits' }]
      });
    }

    const allowedStatus = ['pending', 'paid', 'cod', 'failed', 'success'];
    const allowedModes = ['online', 'cod', 'na'];

    const payload = {
      formType: req.body.formType || 'order',
      name: (req.body.name || '').trim(),
      email: req.body.email ? req.body.email.trim().toLowerCase() : undefined,
      phone: phoneStr,
      address: (req.body.address || '').trim(),
      city: (req.body.city || '').trim(),
      state: (req.body.state || '').trim(),
      pincode: pincodeStr,
      productName: req.body.productName || 'Custom Order',
      productId: req.body.productId,
      productPrice: req.body.productPrice ? Number(req.body.productPrice) : 0,
      paymentStatus: allowedStatus.includes(req.body.paymentStatus) ? req.body.paymentStatus : 'pending',
      paymentMode: allowedModes.includes(req.body.paymentMode) ? req.body.paymentMode : 'na',
      notes: req.body.notes ? req.body.notes.trim() : undefined,
      cartItems: Array.isArray(req.body.cartItems) ? req.body.cartItems : [],
      meta: req.body.meta || {}
    };

    console.log('📦 Creating order with payload:', {
      formType: payload.formType,
      name: payload.name,
      phone: payload.phone,
      pincode: payload.pincode
    });

    const order = await createOrderRecord(payload);
    
    // Send emails (non-blocking)
    dispatchEmails(order).catch((err) => {
      console.error('❌ Email dispatch error (non-blocking):', err);
    });

    res.status(201).json({
      success: true,
      message: 'Order submitted successfully. You will receive a confirmation email shortly.',
      data: {
        orderId: order.orderId,
        formType: order.formType,
        submittedAt: order.createdAt
      }
    });
  } catch (err) {
    console.error('❌ createPublicOrder error:', err);
    next(err);
  }
};

exports.listAdminOrders = async (req, res, next) => {
  try {
    if (!req.user || req.authType !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50); // Increased default limit
    const skip = (page - 1) * limit;
    const filter = {};
    
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    if (req.query.formType) {
      filter.formType = req.query.formType;
    }

    const [orders, total] = await Promise.all([
      CustomerOrder.find(filter)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance
      CustomerOrder.countDocuments(filter)
    ]);

    // Ensure all orders have required fields
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderId: order.orderId || order._id.toString().substring(0, 8),
      name: order.name || 'N/A',
      phone: order.phone || 'N/A',
      email: order.email || 'N/A',
      address: order.address || 'N/A',
      city: order.city || 'N/A',
      state: order.state || 'N/A',
      pincode: order.pincode || 'N/A',
      productName: order.productName || 'Custom Order',
      productPrice: order.productPrice || 0,
      paymentStatus: order.paymentStatus || 'pending',
      paymentMode: order.paymentMode || 'na',
      formType: order.formType || 'order',
      notes: order.notes || '',
      createdAt: order.createdAt || new Date(),
      updatedAt: order.updatedAt || new Date()
    }));

    res.json({
      success: true,
      message: 'Orders retrieved successfully',
      data: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + formattedOrders.length < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('❌ listAdminOrders error:', err);
    next(err);
  }
};

exports.recordCheckoutOrder = async ({ user, address, cartSummary, paymentMode, paymentStatus, orderId }) => {
  if (!user || !address) return null;

  const payload = {
    formType: paymentMode === 'cod' ? 'cod' : 'checkout',
    orderId,
    name: `${user.first_name || user.username || ''}`.trim() || 'Customer',
    email: user.email,
    phone: address.mob1 ? String(address.mob1) : user.phone || '',
    address: [address.address, address.area, address.city, address.state].filter(Boolean).join(', '),
    city: address.city,
    state: address.state,
    pincode: address.postalcode || address.pincode,
    productName: cartSummary?.productName,
    productId: cartSummary?.productId,
    productPrice: cartSummary?.total,
    paymentMode,
    paymentStatus,
    cartItems: cartSummary?.items || [],
    meta: {
      legacyOrderIds: cartSummary?.legacyIds || []
    }
  };

  const order = await createOrderRecord(payload);
  await dispatchEmails(order);
  return order;
};

