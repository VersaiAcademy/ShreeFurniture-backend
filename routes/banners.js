//Wooden-Street-Main-Project-\backend\routes\banners.js

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// ✅ Define Banner Schema & Model
let Banner;
try {
  // Try to use existing model if already defined
  Banner = mongoose.model('Banner');
} catch (e) {
  // Create new model if not exists
  const bannerSchema = new mongoose.Schema({
    imageUrl: { 
      type: String, 
      required: [true, 'Banner image URL is required']
    },
    type: { 
      type: String, 
      enum: ['main', 'sale'], 
      default: 'main',
      required: true
    },
    order: { 
      type: Number, 
      default: 0 
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    link: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }, { 
    timestamps: true 
  });

  // Add index for faster queries
  bannerSchema.index({ type: 1, order: 1 });

  Banner = mongoose.model('Banner', bannerSchema);
}

// ✅ Public: Get all banners (sorted by type and order)
router.get('/', async (req, res) => {
  try {
    console.log('📸 Fetching all banners...');
    
    const { type, isActive } = req.query;
    
    let query = {};
    
    // Filter by type if specified
    if (type && ['main', 'sale'].includes(type)) {
      query.type = type;
    }
    
    // Filter by active status if specified
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const banners = await Banner.find(query)
      .sort({ type: 1, order: 1, createdAt: -1 })
      .lean();
    
    console.log(`✅ Found ${banners.length} banners`);
    console.log('Banner breakdown:', {
      main: banners.filter(b => b.type === 'main').length,
      sale: banners.filter(b => b.type === 'sale').length
    });
    
    res.status(200).json({ 
      status: 200,
      banners,
      count: banners.length
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch banners:', error);
    res.status(500).json({ 
      status: 500, 
      message: 'Failed to fetch banners',
      error: error.message
    });
  }
});

// ✅ Public: Get single banner by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        status: 400, 
        message: 'Invalid banner ID' 
      });
    }
    
    const banner = await Banner.findById(id);
    
    if (!banner) {
      return res.status(404).json({ 
        status: 404, 
        message: 'Banner not found' 
      });
    }
    
    res.status(200).json({ 
      status: 200,
      banner 
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch banner:', error);
    res.status(500).json({ 
      status: 500, 
      message: 'Failed to fetch banner',
      error: error.message
    });
  }
});

// ✅ Admin: Create new banner with limits (main<=8, sale<=1)
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('📸 Creating new banner...');
    
    // Check admin authentication
    if (req.authType !== 'admin') {
      console.log('❌ Access denied - not admin');
      return res.status(403).json({ 
        status: 403, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    const { 
      imageUrl, 
      type = 'main', 
      order = 0, 
      title = '', 
      description = '', 
      link = '',
      isActive = true 
    } = req.body;
    
    // Validate required fields
    if (!imageUrl || !imageUrl.trim()) {
      return res.status(400).json({ 
        status: 400, 
        message: 'Banner image URL is required' 
      });
    }
    
    // Validate type
    if (!['main', 'sale'].includes(type)) {
      return res.status(400).json({ 
        status: 400, 
        message: 'Invalid banner type. Must be "main" or "sale"' 
      });
    }

    // ✅ Check limits
    if (type === 'main') {
      const mainCount = await Banner.countDocuments({ type: 'main' });
      console.log(`📊 Current main banners: ${mainCount}/8`);
      
      if (mainCount >= 8) {
        return res.status(400).json({ 
          status: 400, 
          message: 'Main banners limit reached (maximum 8 allowed)' 
        });
      }
    } else if (type === 'sale') {
      const saleCount = await Banner.countDocuments({ type: 'sale' });
      console.log(`📊 Current sale banners: ${saleCount}/1`);
      
      if (saleCount >= 1) {
        return res.status(400).json({ 
          status: 400, 
          message: 'Only one sale banner allowed' 
        });
      }
    }

    // Create banner
    const banner = await Banner.create({ 
      imageUrl: imageUrl.trim(),
      type,
      order: parseInt(order) || 0,
      title: title.trim(),
      description: description.trim(),
      link: link.trim(),
      isActive
    });
    
    console.log('✅ Banner created successfully:', banner._id);
    
    res.status(201).json({ 
      status: 201, 
      message: 'Banner created successfully',
      banner 
    });
    
  } catch (error) {
    console.error('❌ Failed to create banner:', error);
    res.status(500).json({ 
      status: 500, 
      message: 'Failed to create banner',
      error: error.message
    });
  }
});

// ✅ Admin: Update banner
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('📸 Updating banner:', req.params.id);
    
    // Check admin authentication
    if (req.authType !== 'admin') {
      return res.status(403).json({ 
        status: 403, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        status: 400, 
        message: 'Invalid banner ID' 
      });
    }

    const banner = await Banner.findById(id);
    
    if (!banner) {
      return res.status(404).json({ 
        status: 404, 
        message: 'Banner not found' 
      });
    }

    // Update fields
    const updates = {};
    const allowedFields = ['imageUrl', 'type', 'order', 'title', 'description', 'link', 'isActive'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // If type is being changed, check limits
    if (updates.type && updates.type !== banner.type) {
      if (updates.type === 'main') {
        const mainCount = await Banner.countDocuments({ type: 'main' });
        if (mainCount >= 8) {
          return res.status(400).json({ 
            status: 400, 
            message: 'Main banners limit reached (maximum 8 allowed)' 
          });
        }
      } else if (updates.type === 'sale') {
        const saleCount = await Banner.countDocuments({ type: 'sale' });
        if (saleCount >= 1) {
          return res.status(400).json({ 
            status: 400, 
            message: 'Only one sale banner allowed' 
          });
        }
      }
    }

    const updatedBanner = await Banner.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    console.log('✅ Banner updated successfully:', id);

    res.status(200).json({ 
      status: 200, 
      message: 'Banner updated successfully',
      banner: updatedBanner 
    });
    
  } catch (error) {
    console.error('❌ Failed to update banner:', error);
    res.status(500).json({ 
      status: 500, 
      message: 'Failed to update banner',
      error: error.message
    });
  }
});

// ✅ Admin: Delete banner
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Deleting banner:', req.params.id);
    
    // Check admin authentication
    if (req.authType !== 'admin') {
      return res.status(403).json({ 
        status: 403, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        status: 400, 
        message: 'Invalid banner ID' 
      });
    }

    const deleted = await Banner.findByIdAndDelete(id);
    
    if (!deleted) {
      return res.status(404).json({ 
        status: 404, 
        message: 'Banner not found' 
      });
    }

    console.log('✅ Banner deleted successfully:', id);

    res.status(200).json({ 
      status: 200, 
      message: 'Banner deleted successfully',
      deletedBanner: deleted
    });
    
  } catch (error) {
    console.error('❌ Failed to delete banner:', error);
    res.status(500).json({ 
      status: 500, 
      message: 'Failed to delete banner',
      error: error.message
    });
  }
});

// ✅ Admin: Get banner statistics
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    if (req.authType !== 'admin') {
      return res.status(403).json({ 
        status: 403, 
        message: 'Access denied' 
      });
    }

    const mainCount = await Banner.countDocuments({ type: 'main' });
    const saleCount = await Banner.countDocuments({ type: 'sale' });
    const activeCount = await Banner.countDocuments({ isActive: true });
    const totalCount = await Banner.countDocuments();

    res.status(200).json({
      status: 200,
      stats: {
        total: totalCount,
        main: mainCount,
        sale: saleCount,
        active: activeCount,
        inactive: totalCount - activeCount,
        limits: {
          main: { current: mainCount, max: 8, remaining: 8 - mainCount },
          sale: { current: saleCount, max: 1, remaining: 1 - saleCount }
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to get banner stats:', error);
    res.status(500).json({ 
      status: 500, 
      message: 'Failed to get statistics',
      error: error.message
    });
  }
});

module.exports = router;