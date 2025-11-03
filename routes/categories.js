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

const adminOnly = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.isAdmin && req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      return res.status(403).json({ message: 'Admin privileges required', status: 403 });
    }
    next();
  } catch {
    return res.status(403).json({ message: 'Admin privileges required', status: 403 });
  }
};

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', status: 500 });
  }
});

// POST /api/categories (admin)
router.post('/', authenticateToken, adminOnly, [
  body('name').notEmpty().withMessage('Name required'),
  body('slug').notEmpty().withMessage('Slug required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid data', errors: errors.array(), status: 400 });
    }
    const { name, slug } = req.body;
    const exists = await Category.findOne({ $or: [{ name }, { slug }] });
    if (exists) return res.status(400).json({ message: 'Category already exists', status: 400 });
    const cat = await Category.create({ name, slug });
    res.status(201).json(cat);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create category', status: 500 });
  }
});

// PUT /api/categories/:id (admin)
router.put('/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { name, slug } = req.body;
    const updated = await Category.findByIdAndUpdate(req.params.id, { name, slug }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Category not found', status: 404 });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update category', status: 500 });
  }
});

// DELETE /api/categories/:id (admin)
router.delete('/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Category not found', status: 404 });
    res.json({ message: 'Deleted', status: 200 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete category', status: 500 });
  }
});

module.exports = router;
