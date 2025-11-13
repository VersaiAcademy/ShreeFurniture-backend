const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, DeliveryAddress } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        status: 404
      });
    }

    // Fetch user's address
    const address = await DeliveryAddress.findOne({ user: userId });

    res.status(200).json({
      user: user,
      address: address,
      status: 200
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching profile',
      status: 500
    });
  }
});

// Update user profile (including address)
router.put('/:id', authenticateToken, [
  body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('phone').notEmpty().isNumeric().isLength({ min: 10, max: 10 }).withMessage('Phone must be 10 digits'),
  body('address_line1').notEmpty().withMessage('Address line 1 is required'),
  body('address_line2').optional(),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zip').notEmpty().isNumeric().isLength({ min: 5, max: 6 }).withMessage('Zip code must be 5-6 digits'),
  body('landmark').optional(),
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
    const { id } = req.params;

    // Ensure user can only update their own profile
    if (userId.toString() !== id) {
      return res.status(403).json({
        message: 'Unauthorized: Cannot update another user\'s profile',
        status: 403
      });
    }

    // Extract user and address fields
    const userUpdateData = {};
    const addressUpdateData = {};

    if (req.body.first_name) userUpdateData.first_name = req.body.first_name;
    if (req.body.last_name) userUpdateData.last_name = req.body.last_name;
    if (req.body.email) userUpdateData.email = req.body.email;
    if (req.body.phone) userUpdateData.phone = req.body.phone;

    // Address fields - phone is required
    addressUpdateData.address = req.body.address_line1;
    addressUpdateData.area = req.body.address_line2 || req.body.address_line1;
    addressUpdateData.city = req.body.city;
    addressUpdateData.state = req.body.state;
    addressUpdateData.postalcode = req.body.zip;
    addressUpdateData.mob1 = req.body.phone;
    
    // Landmark is optional
    if (req.body.landmark) {
      addressUpdateData.landmark = req.body.landmark;
    }

    // Update user profile
    let updatedUser = null;
    if (Object.keys(userUpdateData).length > 0) {
      updatedUser = await User.findByIdAndUpdate(userId, userUpdateData, { new: true }).select('-password');
    } else {
      updatedUser = await User.findById(userId).select('-password');
    }

    // Update or create delivery address
    let updatedAddress = null;
    updatedAddress = await DeliveryAddress.findOne({ user: userId });
    
    if (updatedAddress) {
      Object.assign(updatedAddress, addressUpdateData);
      await updatedAddress.save();
    } else {
      // Create new address if doesn't exist
      updatedAddress = new DeliveryAddress({
        user: userId,
        address: addressUpdateData.address,
        area: addressUpdateData.area,
        landmark: addressUpdateData.landmark || null,
        city: addressUpdateData.city,
        state: addressUpdateData.state,
        postalcode: addressUpdateData.postalcode,
        mob1: addressUpdateData.mob1
      });
      await updatedAddress.save();
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser,
      address: updatedAddress,
      status: 200
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      message: 'Something went wrong while updating profile',
      status: 500
    });
  }
});

// Get user by ID (admin can access)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        status: 404
      });
    }

    const address = await DeliveryAddress.findOne({ user: id });

    res.status(200).json({
      user: user,
      address: address,
      status: 200
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      message: 'Something went wrong while fetching user',
      status: 500
    });
  }
});

module.exports = router;
