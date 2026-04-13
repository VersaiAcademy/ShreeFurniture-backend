const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  category: {
    type: String,
    required: true,
    enum: ['beds', 'sofas', 'dining', 'study-office', 'storage', 'trend-alert', 'buying-guide'],
    default: 'buying-guide'
  },
  categoryName: {
    type: String,
    required: true
  },
  author: {
    type: String,
    default: 'Admin'
  },
  date: {
    type: String,
    default: () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  },
  excerpt: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  },
  views: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

blogSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Blog', blogSchema);