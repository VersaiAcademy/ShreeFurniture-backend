#!/usr/bin/env node

/**
 * Meta Product Feed Generator
 * Generates static XML feed from MongoDB and saves to public folder
 * 
 * Usage:
 *   npm run generate-meta-feed
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Fetches all products
 * 3. Generates XML
 * 4. Saves to frontend/public/meta-product-feed.xml
 * 5. Ready to serve as static file
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const { Product } = require('./models');

const MONGO_URI = process.env.MONGO_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://srifurniturevillage.com';

if (!MONGO_URI) {
  console.error('❌ Missing MONGO_URI in .env');
  process.exit(1);
}

/**
 * Sanitize text for XML
 */
const sanitizeText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .substring(0, 5000); // Limit description length
};

/**
 * Generate Meta XML Feed
 */
async function generateMetaFeed() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    console.log('📦 Fetching products from database...');
    const products = await Product.find()
      .select('_id pname pdesc price offer stock_count img1 brand')
      .lean()
      .exec();

    console.log(`✅ Found ${products.length} products`);

    // Build XML feed
    let xmlFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/feeds/gs" xmlns:c="http://base.google.com/cns">
  <channel>
    <title>Sri Furniture Village - Product Catalog</title>
    <link>${FRONTEND_URL}</link>
    <description>Premium Wooden Furniture Products</description>
    <lastBuildDate>${new Date().toISOString()}</lastBuildDate>
`;

    // Add each product
    products.forEach(product => {
      if (!product._id || !product.pname || !product.price) {
        console.warn(`⚠️  Skipping incomplete product: ${product._id}`);
        return;
      }

      const availability = product.stock_count > 0 ? 'in stock' : 'out of stock';
      const imageUrl = product.img1 || `${FRONTEND_URL}/placeholder-product.jpg`;
      const productUrl = `${FRONTEND_URL}/product/${product._id}`;
      const finalPrice = product.offer
        ? Math.floor(product.price - (product.price * product.offer) / 100)
        : product.price;

      const itemXml = `    <item>
      <g:id>${String(product._id).replace(/[<>&"']/g, c =>
        ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]))}</g:id>
      <title>${sanitizeText(product.pname)}</title>
      <description>${sanitizeText(product.pdesc)}</description>
      <link>${productUrl}</link>
      <g:image_link>${imageUrl}</g:image_link>
      <g:price>${finalPrice} INR</g:price>
      <g:availability>${availability}</g:availability>
      <g:brand>${sanitizeText(product.brand || 'Sri Furniture Village')}</g:brand>
      <g:condition>new</g:condition>
    </item>
`;
      xmlFeed += itemXml;
    });

    xmlFeed += `  </channel>
</rss>`;

    // Save to public folder
    const publicFeedPath = path.join(__dirname, '../frontend/public/meta-product-feed.xml');
    const publicDir = path.dirname(publicFeedPath);

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
      console.log(`📁 Created directory: ${publicDir}`);
    }

    fs.writeFileSync(publicFeedPath, xmlFeed, 'utf-8');
    console.log(`✅ Feed saved to: ${publicFeedPath}`);
    console.log(`📊 Total products in feed: ${products.length}`);
    console.log(`🌐 Feed URL: ${FRONTEND_URL}/meta-product-feed.xml`);

    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    console.log('🎉 Meta feed generation complete!');

  } catch (error) {
    console.error('❌ Error generating Meta feed:', error.message);
    process.exit(1);
  }
}

// Run the generator
generateMetaFeed();
