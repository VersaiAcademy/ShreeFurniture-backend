const express = require('express');
const { body, validationResult } = require('express-validator');
const { Product, Order, User, Admin } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ✅ Admin middleware to check if user is admin
const adminAuth = async (req, res, next) => {
  try {
    console.log('Admin Auth Check - authType:', req.authType);
    console.log('Admin Auth Check - user:', req.user);

    // authenticateToken sets req.user (User or Admin) and req.authType
    if (req.authType === 'admin' && req.user && req.user._id) {
      req.admin = req.user;
      return next();
    }

    // Fallback: try to resolve by _id if token payload differs
    const candidateId = req.user && (req.user._id || req.user.userId);
    if (candidateId) {
      const admin = await Admin.findById(candidateId);
      if (admin) {
        req.admin = admin;
        return next();
      }
    }

    return res.status(403).json({
      message: 'Access denied. Admin privileges required.',
      status: 403
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(403).json({
      message: 'Access denied. Admin privileges required.',
      status: 403
    });
  }
};

// ✅ Get all products (Admin view)
router.get('/products', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, category } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { pname: { $regex: search, $options: 'i' } },
        { pdesc: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const products = await Product.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments(query);
    
    console.log(`✅ Fetched ${products.length} products for admin`);
    
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

// ✅ Create product (Admin) - UPDATED VALIDATION
router.post('/products', authenticateToken, adminAuth, [
  body('pname').notEmpty().trim().withMessage('Product name is required'),
  body('pdesc').notEmpty().trim().withMessage('Product description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('offer').optional().isFloat({ min: 0, max: 100 }).withMessage('Offer must be between 0-100'),
  body('stock_count').optional().isInt({ min: 0 }).withMessage('Stock count must be a positive number'),
  body('material').notEmpty().trim().withMessage('Material is required'),
  body('warranty').notEmpty().trim().withMessage('Warranty is required'),
  body('brand').notEmpty().trim().withMessage('Brand is required'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1-5'),
  body('color').optional().trim(),
  body('category').notEmpty().trim().withMessage('Category is required'),
  body('img1').notEmpty().withMessage('At least one product image is required')
], async (req, res) => {
  try {
    // ✅ Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array(),
        status: 400
      });
    }

    console.log('📦 Creating product with data:', req.body);

    const {
      pname, pdesc, price, offer, stock_count,
      material, warranty, brand, rating, color,
      category, img1, img2, img3, img4, img5
    } = req.body;

    // ✅ Create product with all fields
    const product = new Product({
      pname: pname.trim(),
      pdesc: pdesc.trim(),
      price: parseFloat(price),
      offer: offer ? parseFloat(offer) : 0,
      stock_count: stock_count ? parseInt(stock_count) : 0,
      img1: img1,
      img2: img2 || '',
      img3: img3 || '',
      img4: img4 || '',
      img5: img5 || '',
      material: material.trim(),
      warranty: warranty.trim(),
      brand: brand.trim(),
      rating: rating ? parseInt(rating) : 5,
      color: color ? color.trim() : '',
      category: category.trim()
    });

    await product.save();

    console.log('✅ Product created successfully:', product._id);

    res.status(201).json({
      message: 'Product created successfully',
      product,
      status: 201
    });

  } catch (error) {
    console.error('❌ Create product error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors,
        status: 400
      });
    }
    
    res.status(500).json({
      message: 'Something went wrong while creating product',
      error: error.message,
      status: 500
    });
  }
});

// ✅ Update product (Admin)
router.put('/products/:id', authenticateToken, adminAuth, async (req, res) => {
  try {
    console.log(`📝 Updating product ${req.params.id}`, req.body);
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      console.log('❌ Product not found:', req.params.id);
      return res.status(404).json({
        message: 'Product not found',
        status: 404
      });
    }

    // ✅ Update with trimmed values
    const updateData = {
      ...req.body,
      pname: req.body.pname ? req.body.pname.trim() : product.pname,
      pdesc: req.body.pdesc ? req.body.pdesc.trim() : product.pdesc,
      material: req.body.material ? req.body.material.trim() : product.material,
      warranty: req.body.warranty ? req.body.warranty.trim() : product.warranty,
      brand: req.body.brand ? req.body.brand.trim() : product.brand,
      color: req.body.color ? req.body.color.trim() : product.color,
      category: req.body.category ? req.body.category.trim() : product.category
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('✅ Product updated successfully:', updatedProduct._id);

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct,
      status: 200
    });

  } catch (error) {
    console.error('❌ Update product error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors,
        status: 400
      });
    }
    
    res.status(500).json({
      message: 'Something went wrong while updating product',
      error: error.message,
      status: 500
    });
  }
});

// ✅ Delete product (Admin)
router.delete('/products/:id', authenticateToken, adminAuth, async (req, res) => {
  try {
    console.log(`🗑️ Deleting product ${req.params.id}`);
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      console.log('❌ Product not found:', req.params.id);
      return res.status(404).json({
        message: 'Product not found',
        status: 404
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    console.log('✅ Product deleted successfully:', req.params.id);

    res.status(200).json({
      message: 'Product deleted successfully',
      status: 200
    });

  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({
      message: 'Something went wrong while deleting product',
      error: error.message,
      status: 500
    });
  }
});

// ✅ Get all orders (Admin)
router.get('/orders', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await Order.find(query)
      .populate('product', 'pname img1 price')
      .populate('user', 'username email first_name last_name')
      .populate('address', 'address city state postalcode mob1')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Order.countDocuments(query);
    
    res.status(200).json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalOrders: total,
        hasNext: skip + orders.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching orders',
      status: 500
    });
  }
});

// ✅ Update order status (Admin)
router.put('/orders/:id', authenticateToken, adminAuth, [
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

    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('product', 'pname img1 price')
     .populate('user', 'username email first_name last_name')
     .populate('address', 'address city state postalcode mob1');

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

// ✅ Get dashboard stats (Admin)
router.get('/dashboard', authenticateToken, adminAuth, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'confirmed' });
    
    const recentOrders = await Order.find()
      .populate('product', 'pname img1 price')
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    res.status(200).json({
      stats: {
        totalProducts,
        totalOrders,
        totalUsers,
        pendingOrders,
        totalRevenue: totalRevenue[0]?.total || 0
      },
      recentOrders
    });
    
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching dashboard data',
      status: 500
    });
  }
});

module.exports = router;