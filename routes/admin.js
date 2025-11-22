const express = require('express');
const { body, validationResult } = require('express-validator');
const { Product, Order, User, Admin } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ✅ Admin middleware to check if user is admin
const adminAuth = async (req, res, next) => {
  try {
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

// ✅ Get all registered users (Admin view)
router.get('/users', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 100, search } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Select fields that actually exist on User schema
    const rawUsers = await User.find(query)
      .select('username first_name last_name email createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    // Fetch delivery addresses for these users in one query to surface phone numbers
    const userIds = rawUsers.map(u => u._id);
    const DeliveryAddress = require('../models').DeliveryAddress || require('mongoose').model('DeliveryAddress');
    let addresses = [];
    try {
      addresses = await DeliveryAddress.find({ user: { $in: userIds } }).select('user mob1');
    } catch (addrErr) {
      console.error('DeliveryAddress lookup error:', addrErr.message);
    }

    const addrMap = addresses.reduce((acc, a) => {
      acc[a.user.toString()] = a.mob1;
      return acc;
    }, {});

    // Map users to a consistent shape for the admin frontend
    const users = rawUsers.map(u => ({
      _id: u._id,
      name: `${u.first_name || ''}${u.first_name && u.last_name ? ' ' : ''}${u.last_name || u.username || ''}`.trim(),
      username: u.username,
      email: u.email,
      phone: addrMap[u._id.toString()] || null,
      createdAt: u.createdAt
    }));

    res.status(200).json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalUsers: total
      }
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message, status: 500 });
  }
});

// ✅ Get single user details (Admin)
router.get('/users/:id', authenticateToken, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found', status: 404 });

    const DeliveryAddress = require('../models').DeliveryAddress || require('mongoose').model('DeliveryAddress');
    const address = await DeliveryAddress.findOne({ user: id }).select('-__v');

    // Get recent orders for this user
    const recentOrders = await Order.find({ user: id })
      .select('order_id total status createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const totalOrders = await Order.countDocuments({ user: id });

    res.status(200).json({
      user,
      address,
      recentOrders,
      totalOrders,
      status: 200
    });
  } catch (error) {
    console.error('Get admin user details error:', error);
    res.status(500).json({ message: 'Failed to fetch user details', error: error.message, status: 500 });
  }
});

// 🟢 Create product (Admin) - UPDATED TO INCLUDE ALL NEW FIELDS
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
  body('category').notEmpty().trim().withMessage('Category is required'),
  body('img1').optional(),
  body('note').optional().trim(),
  body('color').optional().trim(),
  body('dimensions').optional().trim(),
  body('mattress_size').optional().trim(),
  body('caring').optional().trim(),
  body('stone_finish_image').optional({ checkFalsy: true }).isURL(),
  body('natural_finish_image').optional({ checkFalsy: true }).isURL(),
], async (req, res) => {
  try {
    // ✅ Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array(),
        status: 400
      });
    }

    // Custom validation: At least one variant image is required
    if (!req.body.stone_finish_image && !req.body.natural_finish_image) {
      return res.status(400).json({
        message: 'At least one finish variant image (Stone or Natural) is required',
        status: 400
      });
    }

    // Destructure all required and optional fields, including new ones
    const {
      pname, pdesc, price, offer, stock_count,
      material, warranty, brand, rating, color,
      category, dimensions, dimensions_cm, sku, finish, storage, size, seater,
      features, pack_content, delivery_condition, dispatch_in, customization, note,
      fabric_color, design, img1, img2, img3, img4, img5,
      stone_finish_image, stone_finish_img2, stone_finish_img3, stone_finish_img4,
      stone_finish_img5, stone_finish_img6, stone_finish_img7, stone_finish_img8,
      natural_finish_image, natural_finish_img2, natural_finish_img3, natural_finish_img4,
      natural_finish_img5, natural_finish_img6, natural_finish_img7, natural_finish_img8,
      mattress_size, caring, size_urls, foam, armrest, shape, product_quantity, quantity, leg_material
    } = req.body;

    // ⚠️ Use the spread operator and trim/parse data where necessary
    const product = new Product({
      // Core fields
      pname: pname.trim(),
      pdesc: pdesc.trim(),
      price: parseFloat(price),
      offer: offer ? parseFloat(offer) : 0,
      stock_count: stock_count ? parseInt(stock_count) : 0,
      material: material.trim(),
      warranty: warranty.trim(),
      brand: brand.trim(),
      rating: rating ? parseInt(rating) : 5,
      category: category.trim(),
      
      // Main Images
      img1: img1,
      img2: img2 || '',
      img3: img3 || '',
      img4: img4 || '',
      img5: img5 || '',

      // Variant Images (new fields, up to 8)
      stone_finish_image: stone_finish_image || '',
      stone_finish_img2: stone_finish_img2 || '',
      stone_finish_img3: stone_finish_img3 || '',
      stone_finish_img4: stone_finish_img4 || '',
      stone_finish_img5: stone_finish_img5 || '',
      stone_finish_img6: stone_finish_img6 || '',
      stone_finish_img7: stone_finish_img7 || '',
      stone_finish_img8: stone_finish_img8 || '',
      natural_finish_image: natural_finish_image || '',
      natural_finish_img2: natural_finish_img2 || '',
      natural_finish_img3: natural_finish_img3 || '',
      natural_finish_img4: natural_finish_img4 || '',
      natural_finish_img5: natural_finish_img5 || '',
      natural_finish_img6: natural_finish_img6 || '',
      natural_finish_img7: natural_finish_img7 || '',
      natural_finish_img8: natural_finish_img8 || '',

      // Other Details (new and existing)
      color: color ? color.trim() : '',
      dimensions: dimensions ? dimensions.trim() : '',
      dimensions_cm: dimensions_cm ? dimensions_cm.trim() : '',
      sku: sku ? sku.trim() : '',
      finish: finish ? finish.trim() : '',
      storage: storage ? storage.trim() : 'Without Storage',
      size: size ? size.trim() : '',
      seater: seater ? seater.trim() : '',
      features: features ? features.trim() : '',
      pack_content: pack_content ? pack_content.trim() : '',
      delivery_condition: delivery_condition ? delivery_condition.trim() : 'Knocked Down',
      dispatch_in: dispatch_in ? dispatch_in.trim() : '10-12 Days',
      customization: customization ? customization.trim() : 'Customized can be as per requirement.',
      note: note ? note.trim() : 'If a board is required, we use MDF instead of plywood',
      fabric_color: fabric_color ? fabric_color.trim() : '',
      design: design ? design.trim() : 'Modern',
      mattress_size: mattress_size ? mattress_size.trim() : '',
      caring: caring ? caring.trim() : '',
      // Accept both legacy `size_urls` (map/object) and new `sizeUrls` (array)
      sizeUrls: (
        Array.isArray(req.body.sizeUrls)
          ? req.body.sizeUrls
          : (size_urls && typeof size_urls === 'object'
              ? Object.entries(size_urls).map(([label, url]) => ({ label, url }))
              : [])
      ),
      foam: foam ? foam.trim() : '',
      armrest: armrest ? armrest.trim() : '',
      shape: shape ? shape.trim() : '',
      product_quantity: product_quantity ? product_quantity.trim() : '1 Unit',
      quantity: quantity ? quantity.trim() : '',
      leg_material: leg_material ? leg_material.trim() : '',
    });

    await product.save();

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

// 🟢 Update product (Admin) - UPDATED TO HANDLE ALL NEW FIELDS
router.put('/products/:id', authenticateToken, adminAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        message: 'Product not found',
        status: 404
      });
    }

    // ⚠️ Extract data directly from req.body and let Mongoose handle validation/type casting
    const updateData = {};
    
    // Iterate over req.body to include all fields, applying trimming where appropriate
    for (const key in req.body) {
      // Check if the key exists in the productSchema paths (optional, but good practice)
      if (Product.schema.path(key)) {
        const value = req.body[key];
        
        // Apply trimming to string fields if they are present
        if (typeof value === 'string') {
          updateData[key] = value.trim();
        } else {
          updateData[key] = value;
        }
      }
    }

    // If legacy `size_urls` object was passed, convert to `sizeUrls` array
    if (req.body.size_urls && !req.body.sizeUrls) {
      const possible = req.body.size_urls || {};
      if (typeof possible === 'object' && !Array.isArray(possible)) {
        updateData.sizeUrls = Object.entries(possible).map(([label, url]) => ({ label, url }));
      }
    }

    // Handle numerical fields that might be empty strings (which Mongoose doesn't auto-cast)
    if (updateData.price === '') updateData.price = null;
    if (updateData.offer === '') updateData.offer = 0;
    if (updateData.stock_count === '') updateData.stock_count = 0;
    
    // Explicitly set rating back to default if cleared/missing in update for validation
    if (updateData.rating === '' || updateData.rating === undefined) {
      updateData.rating = product.rating || 5; 
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

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
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        message: 'Product not found',
        status: 404
      });
    }

    await Product.findByIdAndDelete(req.params.id);

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
      .populate('user', 'username email first_name last_name phone')
      .populate('address', 'address_line1 address_line2 city state zip phone')
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
     .populate('user', 'username email first_name last_name phone')
     .populate('address', 'address_line1 address_line2 city state zip phone');

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

    // Add totalCategories
    let totalCategories = 0;
    try {
      const Category = require('../models').Category || require('mongoose').model('Category');
      if (Category) {
        totalCategories = await Category.countDocuments();
      }
    } catch (err) {
      console.error('Category count error:', err.message);
    }

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
        totalCategories,
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