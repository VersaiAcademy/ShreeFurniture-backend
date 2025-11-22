const express = require('express');
const { Product } = require('../models');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Debug: return distinct category values present in the products collection
router.get('/distinct-categories', optionalAuth, async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    // Also include lowercased and slug forms for convenience
    const slugify = (s) => String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/\+/g, '').replace(/&/g, '');
    const transformed = categories.map(c => ({ raw: c, lower: String(c || '').toLowerCase(), slug: slugify(c) }));
    res.status(200).json({ count: categories.length, categories: transformed });
  } catch (error) {
    console.error('❌ Error fetching distinct categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
});

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
    
    // Category filter
    if (category) {
      // Support comma-separated lists from frontend (e.g. category=A,B,C)
      // Use case-insensitive exact-match regexes so 'Wooden Sofas', 'wooden sofas',
      // and 'wooden-sofas' variants match DB values regardless of case.
      const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (typeof category === 'string' && category.includes(',')) {
        const parts = category.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          // build regex exact-match (with i flag) for each part
          const regexes = parts.map(p => new RegExp('^' + escapeRegex(p) + '$', 'i'));
          query.category = { $in: regexes };
        }
      } else {
        // single value - make it case-insensitive exact-match
        const val = String(category).trim();
        query.category = new RegExp('^' + escapeRegex(val) + '$', 'i');
      }
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
    
    const products = await Product.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments(query);
    
    // Normalize sizeUrls for each product in the list
    const normalizedProducts = products.map((p) => {
      const po = p.toObject ? p.toObject() : p;
      if (!po.sizeUrls && po.size_urls && typeof po.size_urls === 'object') {
        po.sizeUrls = Object.entries(po.size_urls).map(([label, url]) => ({ label, url }));
      }
      return po;
    });

    res.status(200).json({
      products: normalizedProducts,
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
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        message: 'Product not found',
        status: 404
      });
    }

    // Ensure backward compatibility: if product has legacy `size_urls` map, convert
    // it to `sizeUrls` array so frontend can read consistently.
    let productObj = product.toObject ? product.toObject() : product;
    if (!productObj.sizeUrls && productObj.size_urls && typeof productObj.size_urls === 'object') {
      productObj.sizeUrls = Object.entries(productObj.size_urls).map(([label, url]) => ({ label, url }));
    }

    res.status(200).json(productObj);
    
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

// ✅ Get related products by category (Public) - NEW ENDPOINT
// Returns products from the same category, excluding the current product
router.get('/related/:category', optionalAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const { excludeId, limit = 6 } = req.query;
    
    // Build query to find products in the same category
    let query = { category: category };
    
    // Exclude the current product if provided
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    // Fetch related products, sorted by newest first, limited to avoid too many results
    const relatedProducts = await Product.find(query)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      relatedProducts,
      category,
      count: relatedProducts.length
    });
    
  } catch (error) {
    console.error('❌ Get related products error:', error);
    
    // Handle invalid ObjectId in excludeId
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid product ID',
        status: 400
      });
    }
    
    res.status(500).json({
      message: 'Something went wrong while fetching related products',
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