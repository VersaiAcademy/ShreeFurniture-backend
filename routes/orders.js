const express = require('express');
const { body, validationResult } = require('express-validator');
const { Order, Cart, DeliveryAddress, Product } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Create order
router.post('/', authenticateToken, [
  body('address').isMongoId().withMessage('Valid address ID is required'),
  body('total').isNumeric().withMessage('Total must be a number'),
  body('mode').optional().isIn(['cod', 'online']).withMessage('Mode must be cod or online')
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

    const { address, total, mode = 'cod' } = req.body;
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

    if (cartItems.length === 0) {
      return res.status(400).json({
        message: 'Cart is empty',
        status: 400
      });
    }

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create orders for each cart item
    const orders = [];
    for (const cartItem of cartItems) {
      const order = new Order({
        product: cartItem.product._id,
        order_id: orderId,
        user: userId,
        address: address,
        total: total,
        mode: mode
      });
      
      await order.save();
      orders.push(order);

      // Update product stock
      await Product.findByIdAndUpdate(
        cartItem.product._id,
        { $inc: { stock_count: -cartItem.qty } }
      );
    }

    // Clear cart after successful order
    await Cart.deleteMany({ user: userId });

    res.status(200).json({
      message: 'Order placed successfully. You will receive order within 7 days from today.',
      orders: orders,
      orderId: orderId,
      status: 200
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
      .populate('address', 'address area city state postalcode mob1')
      .populate('user', 'username first_name last_name email')
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
