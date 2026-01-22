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
 * Validate and format price - Meta requires numeric format only
 */
const formatPrice = (price, offer) => {
  let finalPrice = Number(price) || 0;
  if (offer && Number(offer) > 0) {
    finalPrice = Math.floor(finalPrice * (1 - Number(offer) / 100));
  }
  // Meta validator requires numeric only: "123.45" without currency
  return finalPrice % 1 === 0 ? `${finalPrice}.00` : `${finalPrice}`;
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
 * Enhance title to meet Meta minimum requirements (15 chars)
 */
const enhanceTitle = (originalTitle, brand = 'Sri Furniture Village') => {
  let title = sanitizeText(originalTitle || '', 150).trim();
  
  // If title is too short, enhance it
  if (title.length < 15) {
    title = `${brand} Premium ${originalTitle || 'Furniture'}`;
  }
  
  // Ensure minimum 15 chars, maximum 150 chars
  title = title.substring(0, 150);
  if (title.length < 15) {
    title = `${brand} ${title}`;
  }
  
  return title;
};

/**
 * Enhance description to meet Meta minimum requirements (20+ chars)
 */
const enhanceDescription = (originalDesc, title, brand = 'Sri Furniture Village') => {
  let desc = sanitizeText(originalDesc || '', 5000).trim();
  
  // If description is too short or missing, create one
  if (desc.length < 20) {
    desc = `Premium quality ${title} from ${brand}. Excellent craftsmanship and durability for your home.`;
  }
  
  return desc.substring(0, 5000);
};

/**
 * Get product type from category or title
 */
const getProductType = (category, title = '') => {
  const defaultType = 'furniture';
  if (!category) return defaultType;
  
  const cat = String(category).toLowerCase().trim();
  // Map common category patterns
  const categoryMap = {
    'sofa': 'sofas',
    'bed': 'beds',
    'table': 'tables',
    'chair': 'chairs',
    'cabinet': 'storage',
    'shelf': 'shelves',
    'desk': 'desks',
    'storage': 'storage-furniture',
    'dining': 'dining-furniture'
  };
  
  for (const [key, value] of Object.entries(categoryMap)) {
    if (cat.includes(key)) return value;
  }
  
  return cat || defaultType;
};

async function generateMetaFeed() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    console.log('📦 Fetching products from database...');
    const products = await Product.find()
      .select('_id pname pdesc price offer stock_count img1 brand category')
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
      // REQUIRED: Must have ID, at least basic name and price
      if (!product._id || !product.pname || !product.price) {
        skippedProducts++;
        return;
      }

      // Get absolute image URL - MUST NOT be placeholder
      const imageUrl = getAbsoluteImageUrl(product.img1);
      if (!imageUrl) {
        skippedProducts++;
        return;
      }

      // Enhance title and description to meet Meta requirements
      const brand = sanitizeText(product.brand || 'Sri Furniture Village', 100);
      const enhancedTitle = enhanceTitle(product.pname, brand);
      const enhancedDesc = enhanceDescription(product.pdesc, enhancedTitle, brand);

      // Calculate final price with discount
      const finalPrice = formatPrice(product.price, product.offer);
      
      // Determine availability
      const availability = (product.stock_count && Number(product.stock_count) > 0) ? 'in stock' : 'out of stock';
      
      // Get product type
      const productType = getProductType(product.category, product.pname);
      
      // Build safe product ID
      const productId = String(product._id).replace(/[<>&"']/g, c =>
        ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]));
      const productUrl = `${FRONTEND_URL}/DetaileProduct/${productId}`;

      // Build item XML - STRICT META COMPLIANCE
      const itemXml = `    <item>
      <g:id>${productId}</g:id>
      <title>${enhancedTitle}</title>
      <description>${enhancedDesc}</description>
      <link>${productUrl}</link>
      <g:image_link>${imageUrl}</g:image_link>
      <g:price>${finalPrice}</g:price>
      <g:availability>${availability}</g:availability>
      <g:brand>${brand}</g:brand>
      <g:condition>new</g:condition>
      <g:product_type>${productType}</g:product_type>
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
XML Version: 1.0
═══════════════════════════════════════════════════════════

REQUIRED FIELDS VERIFIED:
✅ Every item has: g:id
✅ Every item has: title (15+ chars)
✅ Every item has: description (20+ chars)
✅ Every item has: link
✅ Every item has: g:image_link (absolute URL)
✅ Every item has: g:price (numeric format)
✅ Every item has: g:availability
✅ Every item has: g:brand
✅ Every item has: g:condition
✅ Every item has: g:product_type

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
