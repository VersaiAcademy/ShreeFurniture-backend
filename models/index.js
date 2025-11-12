//Backend/models/index.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  first_name: {
    type: String,
    required: true,
    trim: true
  },
  last_name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 5
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ✅ UPDATED Product Schema with Multi-Variant Images
const productSchema = new mongoose.Schema({
  pname: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  pdesc: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  offer: {
    type: Number,
    default: 0,
    min: [0, 'Offer cannot be negative'],
    max: [100, 'Offer cannot exceed 100%']
  },
  stock_count: {
    type: Number,
    default: 0,
    min: [0, 'Stock count cannot be negative']
  },
  
	// Main Product Images
	// img1 used to be required; product schema updated to allow variant-only products,
	// so make img1 optional and default to an empty string.
	img1: { type: String, default: '' },
  img2: { type: String, default: '' },
  img3: { type: String, default: '' },
  img4: { type: String, default: '' },
  img5: { type: String, default: '' },

  // ✅ Stone Finish Variant Images (Max 4)
  stone_finish_image: { type: String, default: '' }, // Stone 1 (main variant image)
  stone_finish_img2: { type: String, default: '' },
  stone_finish_img3: { type: String, default: '' },
  stone_finish_img4: { type: String, default: '' },

  // ✅ Natural Finish Variant Images (Max 4)
  natural_finish_image: { type: String, default: '' }, // Natural 1 (main variant image)
  natural_finish_img2: { type: String, default: '' },
  natural_finish_img3: { type: String, default: '' },
  natural_finish_img4: { type: String, default: '' },
  
  // Basic Product Information
  material: { 
    type: String, 
    required: [true, 'Material is required'], 
    trim: true 
  },
  warranty: { 
    type: String, 
    required: [true, 'Warranty is required'], 
    trim: true,
    default: '36 Month Warranty'
  },
  brand: { 
    type: String, 
    required: [true, 'Brand is required'], 
    trim: true,
    default: 'SRI FURNITURE VILLAGE'
  },
  rating: { 
    type: Number, 
    default: 5, 
    min: [1, 'Rating must be at least 1'], 
    max: [5, 'Rating cannot exceed 5'] 
  },
	rating_count: {
		type: Number,
		default: 0,
		min: [0, 'Rating count cannot be negative']
	},
  color: { 
    type: String, 
    default: '', 
    trim: true 
  },
  category: { 
    type: String, 
    required: [true, 'Category is required'], 
    trim: true 
  },
  
  // ✅ Essential Product Details
  dimensions: { 
    type: String, 
    default: '', 
    trim: true 
  },
  dimensions_cm: { 
    type: String, 
    default: '', 
    trim: true 
  },
  sku: { 
    type: String, 
    default: '', 
    trim: true 
  },
  finish: { 
    type: String, 
    default: '', 
    trim: true 
  },
  storage: { 
    type: String, 
    default: 'Without Storage', 
    trim: true 
  },
  size: { 
    type: String, 
    default: '', 
    trim: true 
  },
  seater: { 
    type: String, 
    default: '', 
    trim: true 
  },
  
  // ✅ New fields for optional details
  mattress_size: { // Added based on Admin update
    type: String,
    default: '',
    trim: true
  },
  caring: { // Added based on Admin update
    type: String,
    default: '',
    trim: true
  },

  features: { 
    type: String, 
    default: '', 
    trim: true 
  },
  pack_content: { 
    type: String, 
    default: '', 
    trim: true 
  },
  delivery_condition: { 
    type: String, 
    default: 'Knocked Down', 
    trim: true 
  },
  dispatch_in: { 
    type: String, 
    default: '10-12 Days', 
    trim: true 
  },
  customization: { 
    type: String, 
    default: 'Customized can be as per requirement.', 
    trim: true 
  },
	note: { 
		type: String, 
		default: '', 
		trim: true 
	},
  fabric_color: { 
    type: String, 
    default: '', 
    trim: true 
  },
  design: { 
    type: String, 
    default: 'Modern', 
    trim: true 
  },
  
  // Additional fields
  foam: { 
    type: String, 
    default: '', 
    trim: true 
  },
  armrest: { 
    type: String, 
    default: '', 
    trim: true 
  },
  shape: { 
    type: String, 
    default: '', 
    trim: true 
  },
  product_quantity: { 
    type: String, 
    default: '1 Unit', 
    trim: true 
  },
  quantity: { 
    type: String, 
    default: '', 
    trim: true 
  },
  leg_material: { 
    type: String, 
    default: '', 
    trim: true 
  }
}, {
  timestamps: true
});

// Virtual for discounted price
productSchema.virtual('discountedPrice').get(function() {
  return Math.floor(this.price - (this.price * this.offer) / 100);
});

// Index for search
productSchema.index({ pname: 'text', pdesc: 'text', brand: 'text' });

// Cart Schema
const cartSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product_name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  qty: {
    type: Number,
    default: 1,
    min: 1
  }
}, {
  timestamps: true
});

// Delivery Address Schema
const deliveryAddressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mob1: {
    type: Number,
    required: true
  },
  mob2: {
    type: Number,
    default: null
  },
  postalcode: {
    type: Number,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  area: {
    type: String,
    required: true
  },
  landmark: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Order Schema
const orderSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  order_id: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryAddress',
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  mode: {
    type: String,
    default: 'cod',
    enum: ['cod', 'online']
  },
  status: {
    type: String,
    default: 'confirmed',
    enum: ['confirmed', 'dispatched', 'delivered', 'cancelled']
  }
}, {
  timestamps: true
});

// Cancel Item Schema
const cancelItemSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  reason: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  payment_id: {
    type: String,
    required: true
  },
  order_id: {
    type: String,
    required: true
  },
  signature: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Contact Us Schema
const contactUsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  mob: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  img: {
    type: String,
    default: null
  },
  message: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Review Site Schema
const reviewSiteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  place: {
    type: String,
    required: true
  },
  review: {
    type: String,
    required: true
  },
  img: {
    type: String,
    default: null
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  }
}, {
  timestamps: true
});

// Admin Schema
const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 5
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    default: 'admin',
    enum: ['admin', 'super_admin']
  }
}, {
  timestamps: true
});

adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Cart = mongoose.model('Cart', cartSchema);
const DeliveryAddress = mongoose.model('DeliveryAddress', deliveryAddressSchema);
const Order = mongoose.model('Order', orderSchema);
const CancelItem = mongoose.model('CancelItem', cancelItemSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const ContactUs = mongoose.model('ContactUs', contactUsSchema);
const ReviewSite = mongoose.model('ReviewSite', reviewSiteSchema);
const Admin = mongoose.model('Admin', adminSchema);

module.exports = {
  User,
  Product,
  Cart,
  DeliveryAddress,
  Order,
  CancelItem,
  Transaction,
  ContactUs,
  ReviewSite,
  Admin
};