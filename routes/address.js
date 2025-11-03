const express = require('express');
const { body, validationResult } = require('express-validator');
const { DeliveryAddress } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create delivery address
router.post('/', authenticateToken, [
  body('mob1').isNumeric().isLength({ min: 10, max: 10 }).withMessage('Mobile number 1 must be 10 digits'),
  body('mob2').optional().isNumeric().isLength({ min: 10, max: 10 }).withMessage('Mobile number 2 must be 10 digits'),
  body('postalcode').isNumeric().isLength({ min: 6, max: 6 }).withMessage('Postal code must be 6 digits'),
  body('address').notEmpty().withMessage('Address is required'),
  body('area').notEmpty().withMessage('Area is required'),
  body('landmark').notEmpty().withMessage('Landmark is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required')
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

    const {
      mob1, mob2, postalcode, address, area, landmark, city, state
    } = req.body;

    const userId = req.user._id;

    // Check if user already has an address
    const existingAddress = await DeliveryAddress.findOne({ user: userId });
    
    if (existingAddress) {
      return res.status(400).json({
        message: 'Address already exists. Use PUT method to update.',
        status: 400
      });
    }

    const deliveryAddress = new DeliveryAddress({
      user: userId,
      mob1: parseInt(mob1),
      mob2: mob2 ? parseInt(mob2) : null,
      postalcode: parseInt(postalcode),
      address,
      area,
      landmark,
      city,
      state
    });

    await deliveryAddress.save();

    res.status(201).json({
      message: 'Address created successfully',
      address: deliveryAddress,
      status: 201
    });

  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({
      message: 'Something went wrong while creating address',
      status: 500
    });
  }
});

// Get user's delivery address
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const address = await DeliveryAddress.findOne({ user: userId });

    if (!address) {
      return res.status(404).json({
        message: 'Address not found',
        status: 404
      });
    }

    res.status(200).json(address);

  } catch (error) {
    console.error('Get address error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching address',
      status: 500
    });
  }
});

// Update delivery address
router.put('/', authenticateToken, [
  body('mob1').optional().isNumeric().isLength({ min: 10, max: 10 }).withMessage('Mobile number 1 must be 10 digits'),
  body('mob2').optional().isNumeric().isLength({ min: 10, max: 10 }).withMessage('Mobile number 2 must be 10 digits'),
  body('postalcode').optional().isNumeric().isLength({ min: 6, max: 6 }).withMessage('Postal code must be 6 digits'),
  body('address').optional().notEmpty().withMessage('Address cannot be empty'),
  body('area').optional().notEmpty().withMessage('Area cannot be empty'),
  body('landmark').optional().notEmpty().withMessage('Landmark cannot be empty'),
  body('city').optional().notEmpty().withMessage('City cannot be empty'),
  body('state').optional().notEmpty().withMessage('State cannot be empty')
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

    const userId = req.user._id;

    const address = await DeliveryAddress.findOne({ user: userId });

    if (!address) {
      return res.status(404).json({
        message: 'Address not found',
        status: 404
      });
    }

    // Update fields
    const updateData = {};
    if (req.body.mob1) updateData.mob1 = parseInt(req.body.mob1);
    if (req.body.mob2) updateData.mob2 = parseInt(req.body.mob2);
    if (req.body.postalcode) updateData.postalcode = parseInt(req.body.postalcode);
    if (req.body.address) updateData.address = req.body.address;
    if (req.body.area) updateData.area = req.body.area;
    if (req.body.landmark) updateData.landmark = req.body.landmark;
    if (req.body.city) updateData.city = req.body.city;
    if (req.body.state) updateData.state = req.body.state;

    const updatedAddress = await DeliveryAddress.findByIdAndUpdate(
      address._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: 'Address updated successfully',
      address: updatedAddress,
      status: 200
    });

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      message: 'Something went wrong while updating address',
      status: 500
    });
  }
});

// Delete delivery address
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const address = await DeliveryAddress.findOneAndDelete({ user: userId });

    if (!address) {
      return res.status(404).json({
        message: 'Address not found',
        status: 404
      });
    }

    res.status(200).json({
      message: 'Address deleted successfully',
      status: 200
    });

  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      message: 'Something went wrong while deleting address',
      status: 500
    });
  }
});

module.exports = router;
