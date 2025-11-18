//backend/routes/wishlist.js
const express = require('express');
const { Wishlist, Product } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ✅ Add product to wishlist
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product } = req.body;
    const userId = req.user._id || req.user.userId;

    if (!product) {
      return res.status(400).json({
        message: 'Product ID is required',
        status: 400
      });
    }

    // Check if product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({
        message: 'Product not found',
        status: 404
      });
    }

    // Check if already in wishlist
    const existing = await Wishlist.findOne({ user: userId, product });
    if (existing) {
      return res.status(400).json({
        message: 'Product already in wishlist',
        status: 400
      });
    }

    // Add to wishlist
    const wishlistItem = new Wishlist({
      user: userId,
      product
    });

    await wishlistItem.save();

    console.log('✅ Product added to wishlist:', product);

    res.status(201).json({
      message: 'Product added to wishlist',
      wishlistItem,
      status: 201
    });
  } catch (error) {
    console.error('❌ Add to wishlist error:', error);
    res.status(500).json({
      message: 'Failed to add to wishlist',
      error: error.message,
      status: 500
    });
  }
});

// ✅ Get user's wishlist
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;

    const wishlist = await Wishlist.find({ user: userId })
      .populate('product')
      .sort({ addedAt: -1 });

    console.log(`✅ Fetched ${wishlist.length} wishlist items`);

    res.status(200).json({
      wishlist,
      count: wishlist.length,
      status: 200
    });
  } catch (error) {
    console.error('❌ Get wishlist error:', error);
    res.status(500).json({
      message: 'Failed to fetch wishlist',
      error: error.message,
      status: 500
    });
  }
});

// ✅ Check if product is in wishlist
router.get('/check/:productId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const { productId } = req.params;

    const exists = await Wishlist.findOne({ user: userId, product: productId });

    res.status(200).json({
      inWishlist: !!exists,
      status: 200
    });
  } catch (error) {
    console.error('❌ Check wishlist error:', error);
    res.status(500).json({
      message: 'Failed to check wishlist',
      error: error.message,
      status: 500
    });
  }
});

// ✅ Remove product from wishlist
router.delete('/:productId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const { productId } = req.params;

    const result = await Wishlist.findOneAndDelete({ user: userId, product: productId });

    if (!result) {
      return res.status(404).json({
        message: 'Product not in wishlist',
        status: 404
      });
    }

    console.log('✅ Product removed from wishlist:', productId);

    res.status(200).json({
      message: 'Product removed from wishlist',
      status: 200
    });
  } catch (error) {
    console.error('❌ Remove from wishlist error:', error);
    res.status(500).json({
      message: 'Failed to remove from wishlist',
      error: error.message,
      status: 500
    });
  }
});

module.exports = router;
