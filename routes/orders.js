//backend/routes/orders.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { Order, Cart, DeliveryAddress, Product } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { recordCheckoutOrder } = require('../controllers/customerOrderController');

const router = express.Router();

// Create order
router.post('/', authenticateToken, [
  body('address').isMongoId().withMessage('Valid address ID is required'),
  body('total').isNumeric().withMessage('Total must be a number'),
  body('mode').optional().isIn(['cod', 'online']).withMessage('Mode must be cod or online')
], async (req, res) => {
  try {
    console.debug('Create order - req.user:', req.user && {
      _id: req.user._id,
      email: req.user.email,
      username: req.user.username || req.user.first_name
    });
    console.debug('Create order - body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array(),
        status: 400
      });
    }

    const { address, total, mode = 'cod' } = req.body;
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated', status: 401 });
    }
    const userId = req.user._id;

    // Verify address exists and belongs to user
    const deliveryAddress = await DeliveryAddress.findOne({
      _id: address,
      user: userId
    });

    if (!deliveryAddress) {
      return res.status(404).json({
        message: 'Address not found',
        status: 404
      });
    }

    // Get user's cart items
    const cartItems = await Cart.find({ user: userId }).populate('product');

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        message: 'Cart is empty',
        status: 400
      });
    }

    // Filter out any cart items that no longer have a product reference
    const validCartItems = cartItems.filter(ci => ci && ci.product && ci.product._id);
    if (validCartItems.length !== cartItems.length) {
      console.warn(`Create order: removed ${cartItems.length - validCartItems.length} invalid cart items for user ${userId}`);
    }

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create orders for each cart item
    const orders = [];
    for (const cartItem of validCartItems) {
      try {
        const qty = Number.isFinite(Number(cartItem.qty)) ? Number(cartItem.qty) : 1;

        const order = new Order({
          product: cartItem.product._id,
          order_id: orderId,
          user: userId,
          address: address,
          total: Number(total),
          mode: mode
        });

        await order.save();
        orders.push(order);

        // Update product stock if product exists
        if (cartItem.product && cartItem.product._id) {
          await Product.findByIdAndUpdate(
            cartItem.product._id,
            { $inc: { stock_count: -qty } }
          );
        } else {
          console.warn('Skipping stock update for missing product on cartItem:', cartItem._id);
        }
      } catch (innerErr) {
        console.error('Error processing cartItem during order creation:', innerErr, { cartItem });
        // continue with other items instead of failing entire order
      }
    }

    // Clear cart after successful order
    // Remove only the cart items that belong to this user
    try {
      await Cart.deleteMany({ user: userId });
    } catch (delErr) {
      console.warn('Failed to clear cart after order creation:', delErr);
    }

    const cartSummary = {
      total: Number(total),
      productName:
        validCartItems.length === 1
          ? validCartItems[0].product?.pname || validCartItems[0].product_name || 'Order Item'
          : `${validCartItems.length} items`,
      productId:
        validCartItems.length === 1
          ? String(validCartItems[0].product?._id || validCartItems[0].product || '')
          : undefined,
      items: validCartItems.map((item) => ({
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
        paymentMode: mode === 'cod' ? 'cod' : 'checkout',
        paymentStatus: mode === 'cod' ? 'cod' : 'paid',
        orderId
      });
    } catch (notifyErr) {
      console.warn('Failed to record checkout order snapshot', notifyErr.message);
    }

    res.status(200).json({
      message: 'Order placed successfully. You will receive order within 7 days from today.',
      orders: orders,
      orderId: orderId,
      status: 200,
      orderSummary: snapshot
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      message: 'Something went wrong while creating order',
      status: 500
    });
  }
});

// Get user's orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const orders = await Order.find({ user: userId })
      .populate('product', 'pname pdesc img1 price offer brand')
      .populate('address', 'address area city state postalcode mob1')
      .sort({ createdAt: -1 });

    res.status(200).json(orders);

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching orders',
      status: 500
    });
  }
});

// Get single order details
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    
    const orders = await Order.find({ 
      order_id: orderId,
      user: userId 
    })
      .populate('product', 'pname pdesc img1 img2 img3 img4 img5 price offer brand material warranty rating color')
      .populate('address', 'address area city state postalcode mob1 mob2 landmark')
      .populate('user', 'username first_name last_name email');

    if (orders.length === 0) {
      return res.status(404).json({
        message: 'Order not found',
        status: 404
      });
    }

    res.status(200).json(orders);

  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching order details',
      status: 500
    });
  }
});

// Update order status (Admin only - for now, any authenticated user can update)
router.put('/:orderId', authenticateToken, [
  body('status').isIn(['confirmed', 'dispatched', 'delivered', 'cancelled']).withMessage('Invalid status')
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

    const { orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findOneAndUpdate(
      { order_id: orderId },
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        status: 404
      });
    }

    res.status(200).json({
      message: 'Order status updated successfully',
      order,
      status: 200
    });

  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      message: 'Something went wrong while updating order',
      status: 500
    });
  }
});

// Cancel order
router.post('/:orderId/cancel', authenticateToken, [
  body('reason').notEmpty().withMessage('Cancellation reason is required')
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

    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const order = await Order.findOne({
      order_id: orderId,
      user: userId
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        status: 404
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        message: 'Order is already cancelled',
        status: 400
      });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({
        message: 'Cannot cancel delivered order',
        status: 400
      });
    }

    // Update order status
    order.status = 'cancelled';
    await order.save();

    // Restore product stock
    await Product.findByIdAndUpdate(
      order.product,
      { $inc: { stock_count: 1 } }
    );

    res.status(200).json({
      message: 'Order cancelled successfully',
      order,
      status: 200
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      message: 'Something went wrong while cancelling order',
      status: 500
    });
  }
});

// Get all orders (Admin only)
router.get('/admin/all', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('product', 'pname pdesc img1 price offer brand')
      .populate('address', 'address_line1 address_line2 city state zip phone')
      .populate('user', 'username first_name last_name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json(orders);

  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching orders',
      status: 500
    });
  }
});

module.exports = router;
