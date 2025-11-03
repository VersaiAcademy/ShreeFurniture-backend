const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Admin } = require('../models');
const { generateToken, generateAdminToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register user (accept both minimal and extended payloads)
router.post('/signup', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 5 }).withMessage('Password must be at least 5 characters'),
  body('name').optional().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
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

    const { username, first_name, last_name, name, email, password } = req.body;

    // Derive names from 'name' if provided
    let resolvedUsername = username || (name ? name.trim().toLowerCase().replace(/\s+/g, '') : undefined);
    let resolvedFirstName = first_name || (name ? name.split(' ')[0] : undefined);
    let resolvedLastName = last_name || (name && name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : '');

    if (!resolvedUsername || !resolvedFirstName) {
      return res.status(400).json({
        message: 'Name/username and first name are required',
        status: 400
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username: resolvedUsername }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email or username',
        status: 400
      });
    }

    // Create new user
    const user = new User({
      username: resolvedUsername,
      first_name: resolvedFirstName,
      last_name: resolvedLastName,
      email,
      password
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User Created Successfully',
      status: 201,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      message: 'Something went wrong during registration',
      status: 500,
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// Login user
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { username, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      return res.status(400).json({
        message: 'Credentials don\'t match',
        status: 400
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        message: 'Credentials don\'t match',
        status: 400
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Welcome To Wooden Store',
      status: 200,
      token,
      id: user._id,
      username: user.username,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Something went wrong during login',
      status: 500,
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// Logout user (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    res.status(200).json({
      message: 'Logged out successfully',
      status: 200
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      message: 'Something went wrong during logout',
      status: 500
    });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.status(200).json({
      user: req.user,
      status: 200
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      message: 'Something went wrong',
      status: 500
    });
  }
});

// ✅ Admin login - FIXED to use generateAdminToken
router.post('/admin/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { email, password } = req.body;

    console.log('🔐 Admin login attempt for:', email);

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      console.log('❌ Admin not found:', email);
      return res.status(401).json({
        message: 'Invalid email or password',
        status: 401
      });
    }

    if (!admin.password) {
      console.log('❌ Admin password not set:', email);
      return res.status(400).json({
        message: 'Invalid email or password',
        status: 400
      });
    }

    // Check password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for admin:', email);
      return res.status(401).json({
        message: 'Invalid email or password',
        status: 401
      });
    }

    // Ensure admin role/access
    const allowedRoles = ['admin', 'super_admin'];
    if (!allowedRoles.includes(admin.role) && !admin.isAdmin) {
      console.log('❌ Access denied for role:', admin.role);
      return res.status(403).json({
        message: 'Access denied - insufficient permissions',
        status: 403
      });
    }

    // ✅ Generate ADMIN token using generateAdminToken
    const token = generateAdminToken(admin._id);

    console.log('✅ Admin logged in successfully:', email);

    res.status(200).json({
      message: 'Admin login successful',
      status: 200,
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      message: 'Server error during admin login',
      status: 500,
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
});

// ✅ Create first admin (development only - remove in production)
router.post('/admin/create-first', async (req, res) => {
  try {
    // Check if any admin already exists
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(400).json({
        message: 'Admin already exists. This route is for first-time setup only.',
        status: 400
      });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        message: 'Email, password, and name are required',
        status: 400
      });
    }

    // Create first admin
    const admin = new Admin({
      email: email.toLowerCase(),
      password,
      name,
      role: 'super_admin'
    });

    await admin.save();

    console.log('✅ First admin created:', email);

    res.status(201).json({
      message: 'First admin created successfully',
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      status: 201
    });

  } catch (error) {
    console.error('❌ Create admin error:', error);
    res.status(500).json({
      message: 'Failed to create admin',
      error: error.message,
      status: 500
    });
  }
});

module.exports = router;