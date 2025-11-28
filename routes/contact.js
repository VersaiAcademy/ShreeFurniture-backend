const express = require('express');
const { body, validationResult } = require('express-validator');
const { ContactUs, ReviewSite } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');
const sendMail = require('../utils/sendMail');
const { getAdminEmail } = require('../config/emailConfig');

const router = express.Router();
const ADMIN_EMAIL = getAdminEmail();

const { buildContactFormEmail } = require('../utils/emailTemplates');

const notifyContact = async (payload) => {
  if (!ADMIN_EMAIL) {
    console.warn('⚠️ ADMIN_EMAIL not configured. Cannot send contact notification.');
    return;
  }
  
  try {
    console.log(`📧 Preparing to send contact notification to: ${ADMIN_EMAIL}`);
    
    const html = buildContactFormEmail({
      name: payload.name,
      email: payload.email,
      mob: payload.mob,
      reason: payload.reason,
      message: payload.message,
      img: payload.img,
      createdAt: payload.createdAt || payload.created_at
    });
    
    await sendMail({
      to: ADMIN_EMAIL,
      subject: `New Contact Form Submission - ${payload.name}`,
      html
    });
    
    console.log(`✅ Contact form email sent successfully to ${ADMIN_EMAIL}`);
  } catch (error) {
    console.error('❌ Failed to send contact form email:', error);
    throw error; // Re-throw so caller can handle
  }
};

// Contact us form submission
router.post('/contactus', upload.single('img'), [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  body('email').trim().isEmail().withMessage('Please provide a valid email address'),
  body('mob').trim().isLength({ min: 10, max: 10 }).withMessage('Phone number must be exactly 10 digits').isNumeric().withMessage('Phone number must be numeric'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, mob, reason, message } = req.body;
    const img = req.file ? req.file.path : null;

    // Validate phone is exactly 10 digits
    const phoneStr = String(mob).replace(/\D/g, '');
    if (phoneStr.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be exactly 10 digits',
        errors: [{ param: 'mob', msg: 'Phone number must be exactly 10 digits' }]
      });
    }

    const contactUs = new ContactUs({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mob: parseInt(phoneStr),
      reason: reason.trim(),
      img,
      message: message.trim()
    });

    await contactUs.save();
    
    // Send email notification (don't block response if email fails)
    notifyContact(contactUs).catch((err) => {
      console.error('❌ Contact email failed:', err);
      console.error('❌ Email error details:', {
        message: err.message,
        code: err.code,
        response: err.response
      });
      // Log but don't fail the request - form is saved
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your response. We will get back to you soon.',
      data: {
        id: contactUs._id,
        submittedAt: contactUs.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Contact us error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while submitting contact form. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
