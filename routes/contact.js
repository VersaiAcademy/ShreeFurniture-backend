const express = require('express');
const { body, validationResult } = require('express-validator');
const { ContactUs, ReviewSite } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');

const router = express.Router();

// Contact us form submission
router.post('/contactus', upload.single('img'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('mob').isNumeric().withMessage('Mobile number must be numeric'),
  body('reason').notEmpty().withMessage('Reason is required'),
  body('message').notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array(),
        status: 400
      });
    }

    const { name, email, mob, reason, message } = req.body;
    const img = req.file ? req.file.path : null;

    const contactUs = new ContactUs({
      name,
      email,
      mob: parseInt(mob),
      reason,
      img,
      message
    });

    await contactUs.save();

    res.status(201).json({
      message: 'Thank you for your response. We will get back to you soon.',
      status: 201
    });

  } catch (error) {
    console.error('Contact us error:', error);
    res.status(500).json({
      message: 'Something went wrong while submitting contact form',
      status: 500
    });
  }
});

// Submit site review
router.post('/review', authenticateToken, upload.single('img'), [
  body('name').notEmpty().withMessage('Name is required'),
  body('place').notEmpty().withMessage('Place is required'),
  body('review').notEmpty().withMessage('Review is required'),
  body('rating').isNumeric().isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array(),
        status: 400
      });
    }

    const { name, place, review, rating } = req.body;
    const img = req.file ? req.file.path : null;

    const reviewSite = new ReviewSite({
      name,
      place,
      review,
      img,
      rating: parseFloat(rating)
    });

    await reviewSite.save();

    res.status(201).json({
      message: 'Thank you for your response. Your review has been submitted.',
      status: 201
    });

  } catch (error) {
    console.error('Review submission error:', error);
    res.status(500).json({
      message: 'Something went wrong while submitting review',
      status: 500
    });
  }
});

// Get all reviews
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await ReviewSite.find()
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      reviews,
      status: 200
    });

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching reviews',
      status: 500
    });
  }
});

// Get contact submissions (Admin only)
router.get('/contactus', authenticateToken, async (req, res) => {
  try {
    const contacts = await ContactUs.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      contacts,
      status: 200
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching contacts',
      status: 500
    });
  }
});

module.exports = router;
