const jwt = require('jsonwebtoken');
const { User, Admin } = require('../models');

// ✅ Authentication middleware - Handles both User and Admin tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        status: 401 
      });
    }

    let decoded = null;
    let principal = null;
    let authType = null;

    // ✅ Try to verify as Admin token first (using JWT_ADMIN_SECRET or fallback to JWT_SECRET)
    try {
      const adminSecret = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
      decoded = jwt.verify(token, adminSecret);

      // Try to find admin by various possible ID fields
      const adminId = decoded.adminId || decoded._id || decoded.userId || decoded.id;
      principal = await Admin.findById(adminId).select('-password');

      if (principal) {
        authType = 'admin';
        // Minimal logging for admin auth
        console.log('✅ Admin authenticated');
      }
    } catch (adminError) {
      // Don't spam logs with stack traces for expected verify failures
      // Try user token silently next
    }

    // ✅ If not admin, try to verify as User token
    if (!principal) {
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded._id || decoded.userId || decoded.id;
        const user = await User.findById(userId).select('-password');

        if (user) {
          authType = 'user';
          // Attach only a minimal user object to req.user (do NOT expose password)
          req.user = {
            _id: user._id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email
          };
          console.log('✅ User authenticated:', req.user.username || req.user.email || req.user._id);
          // set principal for downstream admin check (if any)
          principal = user;
        }
      } catch (userError) {
        // silent fail for user token verification
      }
    }

    // ✅ If no principal found, return 401
    if (!principal) {
      return res.status(401).json({ 
        message: 'Invalid token - user/admin not found',
        status: 401 
      });
    }

    // If admin authenticated, attach minimal admin info
    if (authType === 'admin' && principal) {
      req.user = {
        _id: principal._id,
        name: principal.name || principal.email,
        email: principal.email
      };
    }

    // If user authenticated above, req.user is already set to decoded user info
    if (authType === 'user' && req.user) {
      // already attached
    }

    req.authType = authType;
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(403).json({ 
      message: 'Invalid or expired token',
      status: 403 
    });
  }
};

// ✅ Optional authentication middleware (for routes that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded._id || decoded.userId || decoded.id;
        const user = await User.findById(userId).select('-password');
        if (user) {
          req.user = {
            _id: user._id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email
          };
          req.authType = 'user';
        }
      } catch (error) {
        // Silently fail, continue without auth
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// ✅ Generate JWT token for User
const generateToken = (user) => {
  // Accept either a user object or a user id
  let payload = {};
  if (!user) user = {};
  if (typeof user === 'string' || typeof user === 'number') {
    payload._id = String(user);
  } else if (user._id) {
    payload._id = String(user._id);
    if (user.email) payload.email = user.email;
    if (user.username) payload.username = user.username;
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ✅ Generate JWT token for Admin
const generateAdminToken = (admin) => {
  const secret = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
  let payload = {};
  if (!admin) admin = {};
  if (typeof admin === 'string' || typeof admin === 'number') {
    payload._id = String(admin);
  } else if (admin._id) {
    payload._id = String(admin._id);
    if (admin.email) payload.email = admin.email;
    if (admin.name) payload.name = admin.name;
  }

  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  generateAdminToken
};