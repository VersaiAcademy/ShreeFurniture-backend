const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { authenticateToken } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { category, limit = 100, status = 'published' } = req.query;
    let query = { status: 'published' };
    if (category && category !== 'all') {
      query.category = category;
    }
    const blogs = await Blog.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ success: true, blogs });
  } catch (error) {
    console.error('GET blogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blogs' });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' });
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    blog.views += 1;
    await blog.save();
    res.json({ success: true, blog });
  } catch (error) {
    console.error('GET blog by slug error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch blog' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.authType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const { title, slug, category, categoryName, author, excerpt, content, image, status } = req.body;
    if (!title || !slug || !category || !excerpt || !content) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const existing = await Blog.findOne({ slug });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Slug already exists' });
    }
    const blog = new Blog({
      title, slug, category, categoryName, author, excerpt, content, image, status
    });
    await blog.save();
    res.status(201).json({ success: true, blog });
  } catch (error) {
    console.error('POST blog error:', error);
    res.status(500).json({ success: false, message: 'Failed to create blog' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.authType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    const { title, slug, category, categoryName, author, excerpt, content, image, status } = req.body;
    if (slug && slug !== blog.slug) {
      const existing = await Blog.findOne({ slug });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Slug already exists' });
      }
    }
    blog.title = title || blog.title;
    blog.slug = slug || blog.slug;
    blog.category = category || blog.category;
    blog.categoryName = categoryName || blog.categoryName;
    blog.author = author || blog.author;
    blog.excerpt = excerpt || blog.excerpt;
    blog.content = content || blog.content;
    blog.image = image || blog.image;
    blog.status = status || blog.status;
    blog.updatedAt = Date.now();
    await blog.save();
    res.json({ success: true, blog });
  } catch (error) {
    console.error('PUT blog error:', error);
    res.status(500).json({ success: false, message: 'Failed to update blog' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.authType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.json({ success: true, message: 'Blog deleted' });
  } catch (error) {
    console.error('DELETE blog error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete blog' });
  }
});

module.exports = router;