// server.js (updated with proper route order)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// Helper to parse CLIENT_ORIGIN env (comma separated) into normalized array
function parseAllowedOrigins(envValue) {
  if (!envValue || typeof envValue !== 'string') return [];
  return envValue
    .split(',')
    .map(s => s.trim().replace(/\/$/, '')) // trim and remove trailing slash
    .filter(Boolean);
}

// Default allowed origins (fallback)
const fallbackOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

const configuredOrigins = parseAllowedOrigins(process.env.CLIENT_ORIGIN);
const allowedOrigins = configuredOrigins.length ? configuredOrigins : fallbackOrigins;

console.log('✅ Allowed CORS origins:', allowedOrigins);

// CORS middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const originNormalized = origin.replace(/\/$/, '');
    console.log('🔍 CORS check incoming origin:', originNormalized);

    if (allowedOrigins.includes(originNormalized)) {
      return callback(null, true);
    }

    if (
      originNormalized.startsWith('http://localhost') ||
      originNormalized.startsWith('http://127.0.0.1') ||
      originNormalized.startsWith('https://localhost') ||
      originNormalized.startsWith('https://127.0.0.1')
    ) {
      return callback(null, true);
    }

    console.error('❌ CORS blocked origin:', originNormalized);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

// Allow preflight for all routes
app.options('*', cors());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/static', express.static(path.join(__dirname, 'static')));
// Serve uploaded files (images) when stored locally
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logger (helpful for debugging)
app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path}`);
  next();
});

// === Routes ===
// Health check endpoint (should be first)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5000
  });
});

// Public routes (no auth required)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/banners', require('./routes/banners'));

// ✅ ADMIN ROUTES - These need authentication
console.log('📦 Registering admin routes...');
try {
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log('✅ Admin routes registered successfully');
} catch (error) {
  console.error('❌ Failed to load admin routes:', error.message);
}

// Public product routes (for frontend display)
app.use('/api/products', require('./routes/products'));

// User protected routes (require user authentication)
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/address', require('./routes/address'));

// Upload routes (require authentication)
app.use('/api/upload', require('./routes/upload'));

// Payment routes
app.use('/api/razorpay', require('./routes/razorpay'));

// List all registered routes (for debugging)
console.log('\n📋 Registered Routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`  ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        const path = middleware.regexp.source.replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/').replace('^', '');
        console.log(`  ${Object.keys(handler.route.methods).join(', ').toUpperCase()} ${path}${handler.route.path}`);
      }
    });
  }
});
console.log('\n');

// 404 handler (must be AFTER all routes)
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware (must be LAST)
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.stack || err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// === Database connection and server start ===
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in environment. Exiting.');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📍 Admin API: http://localhost:${PORT}/api/admin/products`);
      console.log(`📍 Public API: http://localhost:${PORT}/api/products\n`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });