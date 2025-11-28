const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const {
  createPublicOrder,
  listAdminOrders
} = require('../controllers/customerOrderController');

const router = express.Router();

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  body('phone').trim().isLength({ min: 10, max: 10 }).withMessage('Phone number must be exactly 10 digits').isNumeric().withMessage('Phone number must be numeric'),
  body('address').trim().notEmpty().withMessage('Address is required').isLength({ min: 10 }).withMessage('Address must be at least 10 characters'),
  body('pincode').trim().isLength({ min: 6, max: 6 }).withMessage('Pincode must be exactly 6 digits').isNumeric().withMessage('Pincode must be numeric'),
  body('city').trim().notEmpty().withMessage('City is required').isLength({ min: 2 }).withMessage('City must be at least 2 characters'),
  body('email').optional().trim().isEmail().withMessage('Please provide a valid email address')
];

router.post('/order/create', validators, createPublicOrder);

router.get('/admin/orders', authenticateToken, listAdminOrders);

module.exports = router;

