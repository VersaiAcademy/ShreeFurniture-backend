// Backup of server.js before automated fix
// Created by assistant on revert step
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

/* --------------------------- CONFIG --------------------------- */
const NODE_ENV = process.env.NODE_ENV || "production";  // Railway = production
const PORT = process.env.PORT || 5000;


/* --------------------------- CORS (SAFE FOR RAILWAY) ----------- */
const allowedOrigins = [
  "https://shree-furniture-versai.vercel.app",
  "https://shree-furniture-versai-v2ee.vercel.app",
  "https://www.srifurniturevillage.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

// FIX: never block Railway health check.
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const clean = origin.replace(/\/$/, "");

      if (allowedOrigins.includes(clean)) return callback(null, true);

      console.warn("⚠️ CORS allowed (fallback):", clean);
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.options("*", cors());

/* --------------------------- MIDDLEWARE ------------------------ */
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

if (NODE_ENV !== "production") app.use(morgan("dev"));

/* --------------------------- STATIC FOLDERS -------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* --------------------------- HEALTH ---------------------------- */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "ShreeFurniture backend alive" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/* --------------------------- ROUTES ---------------------------- */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/banners", require("./routes/banners"));
app.use("/api/products", require("./routes/products"));

app.use("/api/cart", require("./routes/cart"));
app.use("/api/wishlist", require("./routes/wishlist"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api", require("./routes/publicOrders"));
app.use("/api/address", require("./routes/address"));
app.use("/api/users", require("./routes/users"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/razorpay", require("./routes/razorpay"));
app.use("/api/cashfree", require("./routes/cashfree"));
app.use("/api/admin", require("./routes/admin"));

/* --------------------------- 404 HANDLER ----------------------- */
app.use("/api/*", (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

/* --------------------------- GLOBAL ERRORS --------------------- */
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

/* --------------------------- MONGO + START SERVER -------------- */
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI");
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    app.listen(PORT, () =>
      console.log(`🚀 Server running at port ${PORT} (env=${NODE_ENV})`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB failed:", err.message);
    // Do NOT exit → Railway will keep container alive
  });