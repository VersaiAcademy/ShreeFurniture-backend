const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: String, trim: true },
    productName: { type: String, trim: true },
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 }
  },
  { _id: false }
);

const customerOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    formType: {
      type: String,
      enum: ['order', 'checkout', 'cod', 'custom', 'bulk', 'contact', 'enquiry'],
      default: 'order',
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      trim: true
    },
    productName: {
      type: String,
      trim: true
    },
    productId: {
      type: String,
      trim: true
    },
    productPrice: {
      type: Number,
      default: 0
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'cod', 'failed'],
      default: 'pending'
    },
    paymentMode: {
      type: String,
      enum: ['online', 'cod', 'na'],
      default: 'na'
    },
    notes: {
      type: String,
      trim: true
    },
    cartItems: [cartItemSchema],
    meta: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CustomerOrder', customerOrderSchema);





