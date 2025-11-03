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
      const adminId = decoded.adminId || decoded.userId || decoded.id;
      principal = await Admin.findById(adminId).select('-password');
      
      if (principal) {
        authType = 'admin';
        console.log('✅ Admin authenticated:', principal.email);
      }
    } catch (adminError) {
      console.log('❌ Not an admin token, trying user token...');
    }

    // ✅ If not admin, try to verify as User token
    if (!principal) {
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        principal = await User.findById(userId).select('-password');
        
        if (principal) {
          authType = 'user';
          console.log('✅ User authenticated:', principal.username);
        }
      } catch (userError) {
        console.log('❌ Not a user token either');
      }
    }

    // ✅ If no principal found, return 401
    if (!principal) {
      return res.status(401).json({ 
        message: 'Invalid token - user/admin not found',
        status: 401 
      });
    }

    req.user = principal;
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
        const userId = decoded.userId || decoded.id;
        const user = await User.findById(userId).select('-password');
        if (user) {
          req.user = user;
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
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ✅ Generate JWT token for Admin
const generateAdminToken = (adminId) => {
  const secret = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
  return jwt.sign({ adminId, userId: adminId }, secret, { expiresIn: '7d' });
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  generateAdminToken
};