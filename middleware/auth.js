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

    // ✅ Try to verify as Admin token first (using JWT_ADMIN_SECRET or fallback to JWT_SECRET)
    const adminSecret = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
    try {
      const decoded = jwt.verify(token, adminSecret);

      // Try to find admin by various possible ID fields
      const adminId = decoded.adminId || decoded._id || decoded.userId || decoded.id;
      if (adminId) {
        const admin = await Admin.findById(adminId).select('-password');

        if (admin) {
          // Admin found - set authentication
          req.user = {
            _id: admin._id,
            name: admin.name || admin.email,
            email: admin.email,
            role: admin.role || 'admin',
            isAdmin: true
          };
          req.authType = 'admin';
          return next();
        }
      }
    } catch (adminError) {
      // Admin token verification failed - will try user token next
      // Only proceed if it's a verification error (not a database error)
      if (adminError.name !== 'JsonWebTokenError' && adminError.name !== 'TokenExpiredError') {
        // Database or other error - don't try user token
        throw adminError;
      }
    }

    // ✅ If not admin, try to verify as User token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded._id || decoded.userId || decoded.id;

      if (userId) {
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
          return next();
        }
      }
    } catch (userError) {
      // User token verification also failed
    }

    // ✅ If no principal found, return 401
    return res.status(401).json({
      message: 'Invalid token - user/admin not found',
      status: 401
    });
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
      // ----------------------------------------------------
      // Strategy 1: Try Admin Token
      // ----------------------------------------------------
      try {
        const adminSecret = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
        const decoded = jwt.verify(token, adminSecret);
        const adminId = decoded.adminId || decoded._id || decoded.userId || decoded.id;

        if (adminId) {
          const admin = await Admin.findById(adminId).select('-password');
          if (admin) {
            req.user = {
              _id: admin._id,
              name: admin.name,
              email: admin.email,
              role: admin.role || 'admin',
              isAdmin: true
            };
            req.authType = 'admin';
            return next();
          }
        }
      } catch (adminError) {
        // Not an admin token, proceed to check user token
      }

      // ----------------------------------------------------
      // Strategy 2: Try User Token
      // ----------------------------------------------------
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded._id || decoded.userId || decoded.id;

        if (userId) {
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
        }
      } catch (userError) {
        // Not a user token either, continue as guest
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
