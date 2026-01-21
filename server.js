// backend/server.js
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

/* ---------------------------  CONFIG  --------------------------- */
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 5000);

/* ---------------------------  CORS  ----------------------------- */
const allowedOrigins = [
  'https://shree-furniture-versai.vercel.app',
  'https://shree-furniture-versai-v2ee.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
];

const corsOptions = {
  origin(origin, callback) {
    // allow requests with no origin (curl, mobile apps, postman)
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalized)) return callback(null, true);

    if (NODE_ENV !== 'production') {
      console.warn(`CORS (dev): allowing ${normalized}`);
      return callback(null, true);
    }

    console.error(`CORS blocked: ${normalized}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ---------------------------  MIDDLEWARE  ----------------------- */
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

if (NODE_ENV !== 'production') app.use(morgan('dev'));

// static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/static', express.static(path.join(__dirname, 'static')));

/* ---------------------------  HEALTH  -------------------------- */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    env: NODE_ENV,
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'ShreeFurniture backend running', health: '/api/health' });
});

/* ---------------------------  ROUTES  -------------------------- */
// Keep same routes as before — ensure these files exist
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/products', require('./routes/products'));

app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api', require('./routes/publicOrders'));
app.use('/api/address', require('./routes/address'));
app.use('/api/users', require('./routes/users'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/razorpay', require('./routes/razorpay'));
app.use('/api/cashfree', require('./routes/cashfree'));
app.use('/api/admin', require('./routes/admin'));

/* ----------------------  META PRODUCT FEED (CRITICAL - BEFORE SPA)  ---------- */
// ⚠️ MUST be before the SPA catch-all to prevent React from handling it
app.use('/meta-product-feed.xml', require('./routes/metafeed'));

/* ----------------------  PRODUCTION SPA SERVE  ------------------ */
/*
  Serve frontend production build ONLY when NODE_ENV === 'production'
  and do NOT override /api/* routes or /meta-product-feed.xml.
*/
if (NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));

  app.get('*', (req, res, next) => {
    // skip API routes and meta feed
    if (req.path.startsWith('/api') || req.path === '/meta-product-feed.xml') return next();
    return res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

/* -------------------------  404 & ERRORS  --------------------- */
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err && err.message ? err.message : err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

/* ----------------------  MONGO + START SERVER  ----------------- */
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Missing MONGO_URI in .env — aborting');
  process.exit(1);
}

/*
  Connect to Mongo and start the HTTP server.
  We attach an 'error' listener to the server to detect EADDRINUSE
  and provide a nice message rather than crashing silently.
*/
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (env=${NODE_ENV})`);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use. Please stop the running process or change PORT.`);
        // Provide helpful commands based on platform
        console.error('Windows: netstat -ano | findstr :%s   then taskkill /PID <pid> /F', PORT);
        console.error('Linux/Mac: lsof -i :%s  then kill -9 <pid>', PORT);
        process.exit(1);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });

    // graceful shutdown handlers
    const shutdown = () => {
      console.log('SIGTERM received — shutting down gracefully');
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close().then(() => {
          console.log('Mongo connection closed');
          process.exit(0);
        }).catch((err) => {
          console.error('Error closing MongoDB connection:', err);
          process.exit(1);
        });
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message || err);
    process.exit(1);
  });
