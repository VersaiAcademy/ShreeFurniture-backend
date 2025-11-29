/**
 * server.js
 *
 * Production-ready Express server bootstrap for deployments (Railway, Render, Vercel, Cyclic, etc.)
 *
 * Key features:
 * - Dynamic port: process.env.PORT || 5000
 * - Non-blocking startup: server.listen() is called immediately to accept requests
 * - Async MongoDB connection with safe retries (does not crash on failure)
 * - Logging for server start, DB connected, errors, reconnects, disconnections
 * - Handlers for uncaught exceptions and unhandled rejections (attempt graceful shutdown)
 * - Graceful shutdown for SIGINT and SIGTERM
 * - Exports `app` for serverless/testing
 *
 * Notes:
 * - The app will attempt to (re)connect to MongoDB in the background. If DB is unavailable,
 *   the server keeps running and will retry with exponential backoff. Routes that require DB
 *   should handle DB errors appropriately (e.g., return 503 or meaningful errors).
 */

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();

/* --------------------------- Config / Env --------------------------- */
const NODE_ENV = process.env.NODE_ENV || 'production';
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || '';
const LOG_PREFIX = '[server]';

/* --------------------------- Middleware ----------------------------- */
// Keep startup fast — don't perform long synchronous tasks here.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

if (NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// CORS: simple permissive default with optional allowed-origins handling
const allowedOrigins = [
  'https://shree-furniture-versai.vercel.app',
  /**
   * server.js
   *
   * Production-ready Express server bootstrap for deployments (Railway, Render, Vercel, Cyclic, etc.)
   *
   * Key features:
   * - Dynamic port: process.env.PORT || 5000
   * - Non-blocking startup: server.listen() is called immediately to accept requests
   * - Async MongoDB connection with safe retries (does not crash on failure)
   * - Logging for server start, DB connected, errors, reconnects, disconnections
   * - Handlers for uncaught exceptions and unhandled rejections (attempt graceful shutdown)
   * - Graceful shutdown for SIGINT and SIGTERM
   * - Exports `app` for serverless/testing
   *
   * Notes:
   * - The app will attempt to (re)connect to MongoDB in the background. If DB is unavailable,
   *   the server keeps running and will retry with exponential backoff. Routes that require DB
   *   should handle DB errors appropriately (e.g., return 503 or meaningful errors).
   */

  require('dotenv').config();

  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const morgan = require('morgan');
  const path = require('path');

  const app = express();

  /* --------------------------- Config / Env --------------------------- */
  const NODE_ENV = process.env.NODE_ENV || 'production';
  const PORT = Number(process.env.PORT) || 5000;
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || '';
  const LOG_PREFIX = '[server]';

  /* --------------------------- Middleware ----------------------------- */
  // Keep startup fast — don't perform long synchronous tasks here.
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true, limit: '12mb' }));

  if (NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }

  // CORS: simple permissive default with optional allowed-origins handling
  const allowedOrigins = [
    'https://shree-furniture-versai.vercel.app',
    'https://shree-furniture-versai-v2ee.vercel.app',
    'https://www.srifurniturevillage.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow non-browser tooling (no origin), and any of the allowed origins.
        if (!origin) return callback(null, true);
        const clean = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(clean)) return callback(null, true);
        // Log unexpected origins but allow by default to avoid blocking health checks / proxies.
        console.warn(`${LOG_PREFIX} CORS: allowing request from unknown origin:`, clean);
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })
  );

  app.options('*', cors());

  /* --------------------------- Static & Health ------------------------ */
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Lightweight health endpoints — must be fast and not depend on DB.
  app.get('/', (req, res) => {
    res.json({ ok: true, message: 'ShreeFurniture backend alive', env: NODE_ENV });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  /* --------------------------- Routes --------------------------------
     NOTE: require routes after middleware. Routes themselves may access DB.
  */
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

  /* --------------------------- 404 & Error --------------------------- */
  app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API route not found' });
  });

  // Centralized error handler — always respond with JSON, avoid leaking stack in prod
  app.use((err, req, res, next) => {
    console.error(`${LOG_PREFIX} Unhandled error in request:`, err);
    const status = err.status || 500;
    const payload = { message: err.message || 'Server error' };
    if (NODE_ENV !== 'production') payload.stack = err.stack;
    res.status(status).json(payload);
  });

  /* --------------------------- Server Start -------------------------- */
  /**
   * Start the HTTP server immediately so platform health checks and load balancers
   * can see the process as up while DB connect happens asynchronously.
   */
  let server = null;
  try {
    server = app.listen(PORT, () => {
      console.info(`${LOG_PREFIX} Server listening on port ${PORT} (env=${NODE_ENV})`);
    });
  } catch (err) {
    // Rare: listen can throw synchronously (e.g., port in use). Log and rethrow so process manager can react.
    console.error(`${LOG_PREFIX} Failed to start server listener:`, err);
    throw err;
  }

  /* --------------------------- MongoDB Connect ----------------------- */
  /**
   * Connect to MongoDB using async/await with retry/backoff.
   * Does not crash the server on failure — keeps process alive and retries.
   *
   * Important: routes that require DB should gracefully handle DB errors when connection is not ready.
   */

  const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // keepAlive options can help long-running connections
    serverSelectionTimeoutMS: 5000, // short timeout for initial selection
    socketTimeoutMS: 45000
  };

  let mongoConnected = false;
  let connectAttempt = 0;
  const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes max backoff

  async function connectWithRetry() {
    if (!MONGO_URI) {
      console.error(`${LOG_PREFIX} Missing MONGO_URI environment variable. Skipping DB connection attempts.`);
      return;
    }

    connectAttempt += 1;
    const attemptLabel = `attempt#${connectAttempt}`;
    try {
      console.info(`${LOG_PREFIX} MongoDB connect ${attemptLabel} -> ${MONGO_URI.split('@').pop?.() || '[uri]'}`);
      await mongoose.connect(MONGO_URI, mongooseOptions);
      mongoConnected = true;
      console.info(`${LOG_PREFIX} MongoDB connected (attempt=${connectAttempt})`);
    } catch (err) {
      mongoConnected = false;
      console.error(`${LOG_PREFIX} MongoDB connection failed (${attemptLabel}):`, err.message || err);
      // Exponential backoff with jitter
      const backoff = Math.min(1000 * Math.pow(2, connectAttempt), MAX_BACKOFF_MS);
      const jitter = Math.floor(Math.random() * 500);
      const delay = backoff + jitter;
      console.info(`${LOG_PREFIX} Retrying MongoDB connection in ${Math.round(delay / 1000)}s`);
      setTimeout(connectWithRetry, delay);
    }
  }

  // Listen for mongoose connection events for runtime visibility
  mongoose.connection.on('connected', () => {
    mongoConnected = true;
    console.info(`${LOG_PREFIX} Mongoose event: connected`);
  });
  mongoose.connection.on('reconnected', () => {
    mongoConnected = true;
    console.info(`${LOG_PREFIX} Mongoose event: reconnected`);
  });
  mongoose.connection.on('disconnected', () => {
    mongoConnected = false;
    console.warn(`${LOG_PREFIX} Mongoose event: disconnected`);
  });
  mongoose.connection.on('error', (err) => {
    mongoConnected = false;
    console.error(`${LOG_PREFIX} Mongoose event: error:`, err && err.message ? err.message : err);
  });

  // Start first connection attempt in background (non-blocking)
  connectWithRetry().catch((err) => {
    // Shouldn't get here since connectWithRetry handles errors, but log defensively.
    console.error(`${LOG_PREFIX} Unexpected error initiating MongoDB connection:`, err);
  });

  /* --------------------------- Graceful Shutdown -------------------- */
  /**
   * Close server and DB connections on SIGINT/SIGTERM or in case of fatal errors.
   * We attempt to gracefully close resources; we allow the process manager to restart if needed.
   */

  let shuttingDown = false;

  async function gracefulShutdown(signal) {
    if (shuttingDown) {
      console.warn(`${LOG_PREFIX} gracefulShutdown already in progress (signal=${signal})`);
      return;
    }
    shuttingDown = true;
    console.info(`${LOG_PREFIX} Received ${signal}. Starting graceful shutdown...`);

    const shutdownTasks = [];

    if (server && server.close) {
      shutdownTasks.push(
        new Promise((resolve) => {
          server.close((err) => {
            if (err) {
              console.error(`${LOG_PREFIX} Error closing HTTP server:`, err);
              return resolve(false);
            }
            console.info(`${LOG_PREFIX} HTTP server closed`);
            resolve(true);
          });
          // Force close if not closed in 10s
          setTimeout(() => {
            console.warn(`${LOG_PREFIX} Forcing server close after timeout`);
            resolve(false);
          }, 10000).unref();
        })
      );
    }

    if (mongoose && mongoose.connection) {
      shutdownTasks.push(
        mongoose.connection.close(false).then(() => {
          console.info(`${LOG_PREFIX} Mongoose connection closed`);
          return true;
        }).catch((err) => {
          console.error(`${LOG_PREFIX} Error closing mongoose connection:`, err);
          return false;
        })
      );
    }

    try {
      await Promise.all(shutdownTasks);
    } catch (err) {
      console.error(`${LOG_PREFIX} Error during shutdown tasks:`, err);
    } finally {
      console.info(`${LOG_PREFIX} Shutdown complete. Exiting process.`);
      // Best practice: exit with success for SIGTERM/SIGINT; use non-zero for fatal exceptions
      if (signal === 'SIGTERM' || signal === 'SIGINT') {
        process.exit(0);
      } else {
        process.exit(1);
      }
    }
  }

  /* --------------------------- Fatal Handlers ----------------------- */
  // Uncaught exceptions — log, attempt graceful shutdown, then exit
  process.on('uncaughtException', (err) => {
    console.error(`${LOG_PREFIX} Uncaught Exception:`, err && err.stack ? err.stack : err);
    // Attempt graceful shutdown, then exit with non-zero after a short delay
    setTimeout(() => {
      gracefulShutdown('uncaughtException').catch(() => {
        process.exit(1);
      });
    }, 100).unref();
  });

  // Unhandled promise rejections — log and attempt graceful shutdown
  process.on('unhandledRejection', (reason, promise) => {
    console.error(`${LOG_PREFIX} Unhandled Rejection:`, reason);
    setTimeout(() => {
      gracefulShutdown('unhandledRejection').catch(() => {
        process.exit(1);
      });
    }, 100).unref();
  });

  // SIGINT / SIGTERM from process manager — attempt graceful shutdown and exit 0
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  /* --------------------------- Export for serverless ----------------- */
  // Export the Express app for serverless adapters or tests.
  // Note: when using a serverless platform you may not call app.listen — platform does it for you.
  module.exports = app;
    mongoConnected = true;
    console.info(`${LOG_PREFIX} MongoDB connected (attempt=${connectAttempt})`);
  } catch (err) {
    mongoConnected = false;
    console.error(`${LOG_PREFIX} MongoDB connection failed (${attemptLabel}):`, err.message || err);
    // Exponential backoff with jitter
    const backoff = Math.min(1000 * Math.pow(2, connectAttempt), MAX_BACKOFF_MS);
    const jitter = Math.floor(Math.random() * 500);
    const delay = backoff + jitter;
    console.info(`${LOG_PREFIX} Retrying MongoDB connection in ${Math.round(delay / 1000)}s`);
    setTimeout(connectWithRetry, delay);
  }
}

// Listen for mongoose connection events for runtime visibility
mongoose.connection.on('connected', () => {
  mongoConnected = true;
  console.info(`${LOG_PREFIX} Mongoose event: connected`);
});
mongoose.connection.on('reconnected', () => {
  mongoConnected = true;
  console.info(`${LOG_PREFIX} Mongoose event: reconnected`);
});
mongoose.connection.on('disconnected', () => {
  mongoConnected = false;
  console.warn(`${LOG_PREFIX} Mongoose event: disconnected`);
});
mongoose.connection.on('error', (err) => {
  mongoConnected = false;
  console.error(`${LOG_PREFIX} Mongoose event: error:`, err && err.message ? err.message : err);
});

// Start first connection attempt in background (non-blocking)
connectWithRetry().catch((err) => {
  // Shouldn't get here since connectWithRetry handles errors, but log defensively.
  console.error(`${LOG_PREFIX} Unexpected error initiating MongoDB connection:`, err);
});

/* --------------------------- Graceful Shutdown -------------------- */
/**
 * Close server and DB connections on SIGINT/SIGTERM or in case of fatal errors.
 * We attempt to gracefully close resources; we allow the process manager to restart if needed.
 */

let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) {
    console.warn(`${LOG_PREFIX} gracefulShutdown already in progress (signal=${signal})`);
    return;
  }
  shuttingDown = true;
  console.info(`${LOG_PREFIX} Received ${signal}. Starting graceful shutdown...`);

  const shutdownTasks = [];

  if (server && server.close) {
    shutdownTasks.push(
      new Promise((resolve) => {
        server.close((err) => {
          if (err) {
            console.error(`${LOG_PREFIX} Error closing HTTP server:`, err);
            return resolve(false);
          }
          console.info(`${LOG_PREFIX} HTTP server closed`);
          resolve(true);
        });
        // Force close if not closed in 10s
        setTimeout(() => {
          console.warn(`${LOG_PREFIX} Forcing server close after timeout`);
          resolve(false);
        }, 10000).unref();
      })
    );
  }

  if (mongoose && mongoose.connection) {
    shutdownTasks.push(
      mongoose.connection.close(false).then(() => {
        console.info(`${LOG_PREFIX} Mongoose connection closed`);
        return true;
      }).catch((err) => {
        console.error(`${LOG_PREFIX} Error closing mongoose connection:`, err);
        return false;
      })
    );
  }

  try {
    await Promise.all(shutdownTasks);
  } catch (err) {
    console.error(`${LOG_PREFIX} Error during shutdown tasks:`, err);
  } finally {
    console.info(`${LOG_PREFIX} Shutdown complete. Exiting process.`);
    // Best practice: exit with success for SIGTERM/SIGINT; use non-zero for fatal exceptions
    if (signal === 'SIGTERM' || signal === 'SIGINT') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

/* --------------------------- Fatal Handlers ----------------------- */
// Uncaught exceptions — log, attempt graceful shutdown, then exit
process.on('uncaughtException', (err) => {
  console.error(`${LOG_PREFIX} Uncaught Exception:`, err && err.stack ? err.stack : err);
  // Attempt graceful shutdown, then exit with non-zero after a short delay
  setTimeout(() => {
    gracefulShutdown('uncaughtException').catch(() => {
      process.exit(1);
    });
  }, 100).unref();
});

// Unhandled promise rejections — log and attempt graceful shutdown
process.on('unhandledRejection', (reason, promise) => {
  console.error(`${LOG_PREFIX} Unhandled Rejection:`, reason);
  setTimeout(() => {
    gracefulShutdown('unhandledRejection').catch(() => {
      process.exit(1);
    });
  }, 100).unref();
});

// SIGINT / SIGTERM from process manager — attempt graceful shutdown and exit 0
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/* --------------------------- Export for serverless ----------------- */
// Export the Express app for serverless adapters or tests.
// Note: when using a serverless platform you may not call app.listen — platform does it for you.
module.exports = app;