const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { Admin } = require('../models');
const router = express.Router();

// Dummy Category model fallback (if not in ../models)
let Category;
try { Category = require('../models').Category; } catch { Category = null; }
if (!Category) {
  const mongoose = require('mongoose');
  const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
  });
  Category = mongoose.model('Category', categorySchema);
}

// ✅ Admin-only middleware - checks if user is authenticated as admin
const adminOnly = async (req, res, next) => {
  try {
    // Primary check: req.authType must be 'admin' and req.user.isAdmin must be true
    if (req.authType === 'admin' && req.user && req.user.isAdmin === true) {
      return next();
    }
    
    // Fallback check: verify req.user properties
    if (req.user && (req.user.isAdmin === true || req.user.role === 'admin' || req.user.role === 'super_admin')) {
      return next();
    }
    
    // If neither check passes, deny access
    return res.status(403).json({ 
      message: 'Admin privileges required', 
      status: 403 
    });
  } catch (error) {
    return res.status(403).json({ 
      message: 'Admin privileges required', 
      status: 403 
    });
  }
};

// GET /api/categories (Public - no auth required)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', status: 500 });
  }
});

// POST /api/categories (Admin only)
router.post('/', authenticateToken, adminOnly, [
  body('name').notEmpty().trim().withMessage('Name required'),
  body('slug').notEmpty().trim().withMessage('Slug required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid data', 
        errors: errors.array(), 
        status: 400 
      });
    }
    
    const { name, slug } = req.body;
    const exists = await Category.findOne({ $or: [{ name }, { slug }] });
    if (exists) {
      return res.status(400).json({ 
        message: 'Category already exists', 
        status: 400 
      });
    }
    
    const cat = await Category.create({ name, slug });
    res.status(201).json(cat);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to create category', 
      error: error.message,
      status: 500 
    });
  }
});

// PUT /api/categories/:id (Admin only)
router.put('/:id', authenticateToken, adminOnly, [
  body('name').optional().notEmpty().trim().withMessage('Name cannot be empty'),
  body('slug').optional().notEmpty().trim().withMessage('Slug cannot be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Invalid data', 
        errors: errors.array(), 
        status: 400 
      });
    }
    
    const { name, slug } = req.body;
    const updated = await Category.findByIdAndUpdate(
      req.params.id, 
      { name, slug }, 
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ 
        message: 'Category not found', 
        status: 404 
      });
    }
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to update category', 
      error: error.message,
      status: 500 
    });
  }
});

// DELETE /api/categories/:id (Admin only)
router.delete('/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        message: 'Category not found', 
        status: 404 
      });
    }
    res.json({ 
      message: 'Category deleted successfully', 
      status: 200 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to delete category', 
      error: error.message,
      status: 500 
    });
  }
});

module.exports = router;
