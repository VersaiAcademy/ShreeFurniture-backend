const express = require('express');
const { body, validationResult } = require('express-validator');
const { Cart, Product } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Add item to cart
router.post('/', authenticateToken, [
  body('product').isMongoId().withMessage('Valid product ID is required'),
  body('qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
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

    const { product, qty = 1 } = req.body;
    const userId = req.user._id;

    // Check if product exists
    const productData = await Product.findById(product);
    if (!productData) {
      return res.status(404).json({
        message: 'Product not found',
        status: 404
      });
    }

    // Check if item already exists in cart
    const existingCartItem = await Cart.findOne({
      user: userId,
      product: product
    });

    if (existingCartItem) {
      // Update quantity
      existingCartItem.qty += parseInt(qty);
      await existingCartItem.save();
      
      return res.status(200).json({
        message: 'Cart updated successfully',
        cartItem: existingCartItem,
        status: 200
      });
    }

    // Create new cart item
    const cartItem = new Cart({
      product,
      user: userId,
      product_name: productData.pname,
      price: productData.discountedPrice,
      qty: parseInt(qty)
    });

    await cartItem.save();

    res.status(201).json({
      message: 'Added to Cart',
      cartItem,
      status: 201
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      message: 'Something went wrong while adding to cart',
      status: 500
    });
  }
});

// Get user's cart
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const cartItems = await Cart.find({ user: userId })
      .populate('product', 'pname pdesc img1 img2 img3 img4 img5 price offer stock_count brand rating')
      .sort({ createdAt: -1 });

    res.status(200).json(cartItems);

  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching cart',
      status: 500
    });
  }
});

// Update cart item quantity
router.put('/:itemId', authenticateToken, [
  body('qty').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
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

    const { itemId } = req.params;
    const { qty } = req.body;
    const userId = req.user._id;

    const cartItem = await Cart.findOne({
      _id: itemId,
      user: userId
    });

    if (!cartItem) {
      return res.status(404).json({
        message: 'Cart item not found',
        status: 404
      });
    }

    // Check stock availability
    const product = await Product.findById(cartItem.product);
    if (qty > product.stock_count) {
      return res.status(400).json({
        message: `Only ${product.stock_count} items available in stock`,
        status: 400
      });
    }

    cartItem.qty = parseInt(qty);
    await cartItem.save();

    res.status(200).json({
      message: 'Cart updated successfully',
      cartItem,
      status: 200
    });

  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({
      message: 'Something went wrong while updating cart',
      status: 500
    });
  }
});

// Remove item from cart
router.delete('/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;

    const cartItem = await Cart.findOneAndDelete({
      _id: itemId,
      user: userId
    });

    if (!cartItem) {
      return res.status(404).json({
        message: 'Cart item not found',
        status: 404
      });
    }

    res.status(200).json({
      message: 'Item removed from cart successfully',
      status: 200
    });

  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      message: 'Something went wrong while removing from cart',
      status: 500
    });
  }
});

// Clear entire cart
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    await Cart.deleteMany({ user: userId });

    res.status(200).json({
      message: 'Cart cleared successfully',
      status: 200
    });

  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      message: 'Something went wrong while clearing cart',
      status: 500
    });
  }
});

module.exports = router;
