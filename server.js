// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

/* ==========================
   ✅ CORS Configuration
   ========================== */
const allowedOrigins = [
  'https://shree-furniture-versai.vercel.app',       // Frontend
  'https://shree-furniture-versai-v2ee.vercel.app',  // Admin
  'http://localhost:5173',                           // Local frontend (Vite)
  'http://localhost:3000',                           // Local admin (React)
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

console.log('✅ Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow Postman / direct API calls

    const originNormalized = origin.replace(/\/$/, '');
    console.log('🔍 CORS check incoming origin:', originNormalized);

    if (allowedOrigins.includes(originNormalized)) {
      return callback(null, true);
    }

    console.error('❌ CORS blocked origin:', originNormalized);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

// Allow preflight requests
app.options('*', cors());

/* ==========================
   ✅ Middleware
   ========================== */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static and upload folders
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logger for debugging
app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path}`);
  next();
});

/* ==========================
   ✅ Routes
   ========================== */

// Health check route (first)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    port: process.env.PORT || 5000,
  });
});

// Public routes (no auth)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/products', require('./routes/products'));

// User routes (auth required)
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/address', require('./routes/address'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/razorpay', require('./routes/razorpay'));

// Admin routes (auth required)
console.log('📦 Registering admin routes...');
try {
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log('✅ Admin routes registered successfully');
} catch (err) {
  console.error('❌ Failed to load admin routes:', err.message);
}

/* ==========================
   ✅ Debug: List All Routes
   ========================== */
console.log('\n📋 Registered Routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`  ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        const path = middleware.regexp.source
          .replace('\\/?(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace('^', '');
        console.log(`  ${Object.keys(handler.route.methods).join(', ').toUpperCase()} ${path}${handler.route.path}`);
      }
    });
  }
});
console.log('\n');

/* ==========================
   ✅ 404 & Error Handling
   ========================== */
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.originalUrl);
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  console.error('💥 Unhandled Error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

/* ==========================
   ✅ Database & Server Start
   ========================== */
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set in environment');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health check: https://shreefurniture-backend-production.up.railway.app/api/health`);
      console.log(`📍 Public API: https://shreefurniture-backend-production.up.railway.app/api/products`);
      console.log(`📍 Admin API: https://shreefurniture-backend-production.up.railway.app/api/admin/products`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
