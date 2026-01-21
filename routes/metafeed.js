/**
 * Meta Product Catalog Feed Route
 * Generates XML product feed for Meta Ads
 * Endpoint: /meta-product-feed.xml
 */

const express = require('express');
const { Product } = require('../models');
const router = express.Router();

/**
 * Generate Meta Product Catalog XML Feed
 * GET /meta-product-feed.xml
 * 
 * XML Structure:
 * <rss>
 *   <channel>
 *     <item>
 *       <id>product_id</id>
 *       <title>Product Name</title>
 *       <description>Product Description</description>
 *       <link>Product URL</link>
 *       <image_link>Product Image URL</image_link>
 *       <price>Price with currency</price>
 *       <availability>Availability status</availability>
 *       <brand>Brand name</brand>
 *       <condition>new/used</condition>
 *     </item>
 *   </channel>
 * </rss>
 */
router.get('/', async (req, res) => {
  try {
    // Fetch all active products from database
    const products = await Product.find()
      .select('_id pname pdesc price offer stock_count img1 brand')
      .lean()
      .exec();

    // Get base URL from request (works for both dev and production)
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

    // Build XML RSS feed
    let xmlFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/feeds/gs" xmlns:c="http://base.google.com/cns">
  <channel>
    <title>Sri Furniture Village - Product Catalog</title>
    <link>${baseUrl}</link>
    <description>Premium Wooden Furniture Products</description>
    <lastBuildDate>${new Date().toISOString()}</lastBuildDate>
`;

    // Add each product as an item
    products.forEach(product => {
      if (!product._id || !product.pname || !product.price) {
        console.warn('⚠️ Skipping incomplete product:', product._id);
        return; // Skip products missing essential fields
      }

      // Calculate availability
      const availability = product.stock_count > 0 ? 'in stock' : 'out of stock';

      // Get product image - fallback to placeholder if missing
      const imageUrl = product.img1 
        ? product.img1 
        : `${backendUrl}/placeholder-product.jpg`;

      // Product page URL
      const productUrl = `${baseUrl}/product/${product._id}`;

      // Format price with currency
      const priceWithCurrency = `${product.price} INR`;

      // Calculate final price after offer
      const finalPrice = product.offer 
        ? Math.floor(product.price - (product.price * product.offer) / 100)
        : product.price;

      // Sanitize description - remove HTML tags and special XML characters
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

    // Set response headers
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="meta-product-feed.xml"');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    console.log(`✅ Meta Catalog Feed Generated: ${products.length} products`);
    res.send(xmlFeed);

  } catch (error) {
    console.error('❌ Error generating Meta product feed:', error);
    
    // Return error XML
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Error</title>
    <link>error</link>
    <description>Failed to generate product feed</description>
  </channel>
</rss>`;

    res.status(500)
      .setHeader('Content-Type', 'application/xml; charset=utf-8')
      .send(errorXml);
  }
});

module.exports = router;
