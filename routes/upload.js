const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { upload: cloudinaryUpload } = require('../utils/cloudinary');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Determine base URL for returned image paths
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

// If Cloudinary is configured, prefer that. Otherwise fallback to local disk storage.
const useCloudinary = !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_SECRET);

if (useCloudinary) {
  // Single upload - Cloudinary
  router.post('/', authenticateToken, cloudinaryUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided', status: 400 });
      }

      console.log('📸 Single upload received file:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename,
        path: req.file.path
      });

      // cloudinary uploader returns path in req.file.path (secure_url)
      res.status(200).json({ message: 'Image uploaded successfully', imageUrl: req.file.path, publicId: req.file.filename, status: 200 });
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      res.status(500).json({ message: 'Something went wrong while uploading image', error: error.message, status: 500 });
    }
  });

  // Multiple upload - Cloudinary
  router.post('/multiple', authenticateToken, cloudinaryUpload.array('images', 5), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No image files provided', status: 400 });
      }
      console.log('📸 Multiple upload received files count:', req.files.length);
      console.log('First file sample:', {
        originalname: req.files[0]?.originalname,
        mimetype: req.files[0]?.mimetype,
        size: req.files[0]?.size,
        filename: req.files[0]?.filename,
        path: req.files[0]?.path
      });
      const imageUrls = req.files.map(file => file.path);
      const publicIds = req.files.map(file => file.filename);
      res.status(200).json({ message: 'Images uploaded successfully', imageUrls, publicIds, status: 200 });
    } catch (error) {
      console.error('Cloudinary multiple upload error:', error);
      res.status(500).json({ message: 'Something went wrong while uploading images', error: error.message, status: 500 });
    }
  });

} else {
  // Local disk storage setup
  const uploadDir = path.join(__dirname, '..', 'uploads', 'banners');
  // Ensure directory exists
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.random().toString(36).substring(2,8)}${ext}`;
      cb(null, name);
    }
  });

  const uploadLocal = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    }
  });

  // Single upload - Local
  router.post('/', authenticateToken, uploadLocal.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No image file provided', status: 400 });

      const imageUrl = `${BASE_URL}/uploads/banners/${req.file.filename}`;
      return res.status(200).json({ message: 'Image uploaded successfully', imageUrl, filename: req.file.filename, status: 200 });
    } catch (error) {
      console.error('Local upload error:', error);
      res.status(500).json({ message: 'Something went wrong while uploading image', status: 500 });
    }
  });

  // Multiple upload - Local
  router.post('/multiple', authenticateToken, uploadLocal.array('images', 5), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No image files provided', status: 400 });
      const imageUrls = req.files.map(f => `${BASE_URL}/uploads/banners/${f.filename}`);
      const filenames = req.files.map(f => f.filename);
      return res.status(200).json({ message: 'Images uploaded successfully', imageUrls, filenames, status: 200 });
    } catch (error) {
      console.error('Local multiple upload error:', error);
      res.status(500).json({ message: 'Something went wrong while uploading images', status: 500 });
    }
  });
}

module.exports = router;
