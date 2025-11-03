const express = require('express');
const { Product } = require('../models');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ✅ Get all products with search and pagination (Public)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20, category, minPrice, maxPrice, brand } = req.query;
    
    let query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { pname: { $regex: search, $options: 'i' } },
        { pdesc: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }
    
    // ✅ STRICT Category filter - exact match only
    if (category) {
      query.category = category;  // Changed from regex to strict equality
    }

    // Brand filter
    if (brand) {
      query.brand = { $regex: brand, $options: 'i' };
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // ✅ Debug log BEFORE database query
    console.log('🔍 PRODUCTS QUERY:', { 
      query, 
      req_query: req.query,
      category_filter: category || 'none'
    });
    
    const products = await Product.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments(query);
    
    // ✅ Debug log AFTER database query
    console.log(`✅ Fetched ${products.length} products (Total: ${total})`);
    if (category) {
      console.log(`   Category: "${category}" - Found ${products.length} exact matches`);
    }
    
    res.status(200).json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalProducts: total,
        hasNext: skip + products.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching products',
      error: error.message,
      status: 500
    });
  }
});

// ✅ Get single product by ID (Public)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    console.log('🔍 Fetching product by ID:', req.params.id);
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      console.log('❌ Product not found:', req.params.id);
      return res.status(404).json({
        message: 'Product not found',
        status: 404
      });
    }
    
    console.log('✅ Product found:', product.pname);
    res.status(200).json(product);
    
  } catch (error) {
    console.error('❌ Get product error:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid product ID',
        status: 400
      });
    }
    
    res.status(500).json({
      message: 'Something went wrong while fetching product',
      error: error.message,
      status: 500
    });
  }
});

// ✅ Get products by category (Public) - DEPRECATED in favor of query param
// This route is kept for backward compatibility
router.get('/category/:category', optionalAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('🔍 Category route (deprecated):', category);
    console.log('⚠️  Use /api/products?category=slug instead');
    
    // ✅ Changed to STRICT match instead of regex
    const products = await Product.find({ category: category })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments({ category: category });
    
    console.log(`✅ Fetched ${products.length} products for category: ${category}`);
    
    res.status(200).json({
      products,
      category,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalProducts: total,
        hasNext: skip + products.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Get products by category error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching products',
      error: error.message,
      status: 500
    });
  }
});

module.exports = router;