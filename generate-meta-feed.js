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
 * Sanitize text for XML - Strict Meta compliance
 */
const sanitizeText = (text, maxLength = 5000) => {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;') // Escape bare ampersands
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .substring(0, maxLength);
};

/**
 * Validate and format price - Meta requires decimal format
 */
const formatPrice = (price, offer) => {
  let finalPrice = Number(price) || 0;
  if (offer && Number(offer) > 0) {
    finalPrice = Math.floor(finalPrice * (1 - Number(offer) / 100));
  }
  // Meta requires: "123.45 INR" or just "123 INR"
  return finalPrice % 1 === 0 ? `${finalPrice}.00 INR` : `${finalPrice} INR`;
};

/**
 * Validate and ensure absolute URLs - NO placeholders for Meta
 */
const getAbsoluteImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Already absolute URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Relative path - convert to absolute
  if (imagePath.startsWith('/')) {
    return `${FRONTEND_URL}${imagePath}`;
  }
  
  // No path
  return null;
};

/**
 * Validate required fields for Meta
 */
const validateProductForMeta = (product) => {
  const errors = [];
  
  if (!product._id) errors.push('Missing _id');
  if (!product.pname || product.pname.trim() === '') errors.push('Missing title (pname)');
  if (!product.pdesc || product.pdesc.trim() === '') errors.push('Missing description (pdesc)');
  if (!product.price || Number(product.price) === 0) errors.push('Missing/invalid price');
  if (product.stock_count === undefined) errors.push('Missing stock_count');
  
  return errors;
};

/**
 * Generate Meta XML Feed - Meta Approved Format
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

    // Meta Approved RSS 2.0 Namespace - CORRECT NAMESPACE
    let xmlFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Sri Furniture Village - Product Catalog</title>
    <link>${FRONTEND_URL}</link>
    <description>Premium Wooden Furniture Products</description>
    <lastBuildDate>${new Date().toISOString()}</lastBuildDate>
`;

    let validProducts = 0;
    let skippedProducts = 0;

    // Add each product with strict validation
    products.forEach((product, index) => {
      // Validate required fields
      const validationErrors = validateProductForMeta(product);
      
      if (validationErrors.length > 0) {
        console.warn(`⚠️  Skipping product #${index + 1} (${product._id}): ${validationErrors.join(', ')}`);
        skippedProducts++;
        return;
      }

      // Get absolute image URL - MUST NOT be placeholder
      const imageUrl = getAbsoluteImageUrl(product.img1);
      if (!imageUrl) {
        console.warn(`⚠️  Skipping product #${index + 1} (${product._id}): Missing valid image URL`);
        skippedProducts++;
        return;
      }

      // Calculate final price with discount
      const finalPrice = formatPrice(product.price, product.offer);
      
      // Determine availability
      const availability = (product.stock_count && Number(product.stock_count) > 0) ? 'in stock' : 'out of stock';
      
      // Sanitize all text fields
      const title = sanitizeText(product.pname, 150);
      const description = sanitizeText(product.pdesc, 5000);
      const brand = sanitizeText(product.brand || 'Sri Furniture Village', 100);
      const productId = String(product._id).replace(/[<>&"']/g, c =>
        ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]));
      const productUrl = `${FRONTEND_URL}/DetaileProduct/${productId}`;

      // Build item XML - STRICT META COMPLIANCE
      const itemXml = `    <item>
      <g:id>${productId}</g:id>
      <title>${title}</title>
      <description>${description}</description>
      <link>${productUrl}</link>
      <g:image_link>${imageUrl}</g:image_link>
      <g:price>${finalPrice}</g:price>
      <g:availability>${availability}</g:availability>
      <g:brand>${brand}</g:brand>
      <g:condition>new</g:condition>
    </item>
`;
      xmlFeed += itemXml;
      validProducts++;
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
    
    // Summary
    console.log(`
📊 FEED GENERATION SUMMARY
═══════════════════════════════════════════════════════════
Total Products in Database: ${products.length}
✅ Valid Products in Feed:  ${validProducts}
⚠️  Skipped Products:       ${skippedProducts}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feed Location: frontend/public/meta-product-feed.xml
Feed URL: ${FRONTEND_URL}/meta-product-feed.xml
Namespace: xmlns:g="http://base.google.com/ns/1.0"
XML Version: 2.0
═══════════════════════════════════════════════════════════

REQUIRED FIELDS VERIFIED:
✅ Every item has: title
✅ Every item has: description
✅ Every item has: link
✅ Every item has: g:image_link (absolute URL)
✅ Every item has: g:price (format: number.decimal INR)
✅ Every item has: g:availability
✅ Every item has: g:id
✅ Every item has: g:brand
✅ Every item has: g:condition

🎯 Meta Commerce Manager Compliance: READY FOR UPLOAD
🌐 Feed URL: ${FRONTEND_URL}/meta-product-feed.xml
`);

    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    console.log('🎉 Meta-compliant feed generation complete!');

  } catch (error) {
    console.error('❌ Error generating Meta feed:', error.message);
    process.exit(1);
  }
}

// Run the generator
generateMetaFeed();
