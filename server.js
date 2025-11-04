// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();
const app = express();

/* ================================================
   ✅ CORS Configuration (Frontend + Admin + Local)
   ================================================ */
const allowedOrigins = [
  "https://shree-furniture-versai.vercel.app", // Frontend (Vercel)
  "https://shree-furniture-versai-v2ee.vercel.app", // Admin (Vercel)
  "http://localhost:5173", // Vite (Frontend local)
  "http://localhost:3000", // React (Admin local)
  "http://localhost:5174", // Alternative Vite port
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5174"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      
      const normalizedOrigin = origin.replace(/\/$/, "");
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      
      // Log for debugging
      console.log("⚠️ CORS check - Origin:", normalizedOrigin);
      console.log("⚠️ Allowed origins:", allowedOrigins);
      
      // In development, be more permissive
      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ Development mode - allowing origin");
        return callback(null, true);
      }
      
      console.error("❌ CORS blocked:", normalizedOrigin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
  })
);

// Handle OPTIONS preflight
app.options("*", cors());

/* ================================================
   ✅ Middleware
   ================================================ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static folders
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/static", express.static(path.join(__dirname, "static")));

// Log requests
app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path}`);
  next();
});

/* ================================================
   ✅ Routes
   ================================================ */

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    version: "1.0.0",
  });
});

// Public routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/banners", require("./routes/banners"));
app.use("/api/products", require("./routes/products"));

// Authenticated user routes
app.use("/api/cart", require("./routes/cart"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/address", require("./routes/address"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/razorpay", require("./routes/razorpay"));

// Admin routes
try {
  const adminRoutes = require("./routes/admin");
  app.use("/api/admin", adminRoutes);
  console.log("✅ Admin routes loaded successfully");
} catch (err) {
  console.error("❌ Failed to load admin routes:", err.message);
}

/* ================================================
   ✅ SPA (Single Page App) Handling for Vercel
   ================================================ */
// Serve frontend build (optional if backend also hosts)
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../client/dist");
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

/* ================================================
   ✅ 404 and Error Handling
   ================================================ */
app.use("*", (req, res) => {
  console.log("❌ 404 - Route not found:", req.originalUrl);
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("💥 Error:", err.message);
  res.status(err.status || 500).json({ message: err.message });
});

/* ================================================
   ✅ MongoDB Connection & Server Start
   ================================================ */
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health: /api/health`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
