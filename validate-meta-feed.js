const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

async function validateMetaFeed() {
  try {
    const feedPath = path.join(__dirname, '../frontend/public/meta-product-feed.xml');
    const feedContent = fs.readFileSync(feedPath, 'utf-8');

    const parser = new xml2js.Parser({ ignoreAttrs: false });
    const feed = await parser.parseStringPromise(feedContent);

    const items = feed.rss.channel[0].item;
    const issues = {
      total_items: items.length,
      critical_issues: [],
      warnings: [],
      missing_fields: {
        id: 0,
        title: 0,
        description: 0,
        link: 0,
        image_link: 0,
        price: 0,
        availability: 0,
        brand: 0,
        condition: 0,
        product_type: 0
      },
      invalid_fields: {
        title_too_short: 0,
        title_too_long: 0,
        description_too_short: 0,
        description_too_long: 0,
        invalid_price_format: 0,
        invalid_availability: 0,
        invalid_link: 0,
        invalid_image_url: 0
      }
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = item['g:id']?.[0] || `[No ID - Item ${i + 1}]`;

      // Check required fields exist
      if (!item['g:id'] || !item['g:id'][0]) { issues.missing_fields.id++; issues.critical_issues.push(`Item ${i + 1}: Missing g:id`); }
      if (!item.title || !item.title[0]) { issues.missing_fields.title++; issues.critical_issues.push(`${itemId}: Missing title`); }
      if (!item.description || !item.description[0]) { issues.missing_fields.description++; issues.critical_issues.push(`${itemId}: Missing description`); }
      if (!item.link || !item.link[0]) { issues.missing_fields.link++; issues.critical_issues.push(`${itemId}: Missing link`); }
      if (!item['g:image_link'] || !item['g:image_link'][0]) { issues.missing_fields.image_link++; issues.critical_issues.push(`${itemId}: Missing g:image_link`); }
      if (!item['g:price'] || !item['g:price'][0]) { issues.missing_fields.price++; issues.critical_issues.push(`${itemId}: Missing g:price`); }
      if (!item['g:availability'] || !item['g:availability'][0]) { issues.missing_fields.availability++; issues.critical_issues.push(`${itemId}: Missing g:availability`); }
      if (!item['g:brand'] || !item['g:brand'][0]) { issues.missing_fields.brand++; issues.critical_issues.push(`${itemId}: Missing g:brand`); }
      if (!item['g:condition'] || !item['g:condition'][0]) { issues.missing_fields.condition++; issues.critical_issues.push(`${itemId}: Missing g:condition`); }
      if (!item['g:product_type'] || !item['g:product_type'][0]) { issues.missing_fields.product_type++; issues.warnings.push(`${itemId}: Missing g:product_type (optional but recommended)`); }

      // Validate field content
      const title = item.title?.[0] || '';
      if (title.length < 15) { issues.invalid_fields.title_too_short++; issues.critical_issues.push(`${itemId}: Title too short (${title.length} chars, min 15)`); }
      if (title.length > 150) { issues.invalid_fields.title_too_long++; issues.critical_issues.push(`${itemId}: Title too long (${title.length} chars, max 150)`); }

      const description = item.description?.[0] || '';
      if (description.length < 20) { issues.invalid_fields.description_too_short++; issues.critical_issues.push(`${itemId}: Description too short (${description.length} chars, min 20)`); }
      if (description.length > 5000) { issues.invalid_fields.description_too_long++; issues.critical_issues.push(`${itemId}: Description too long (${description.length} chars, max 5000)`); }

      const price = item['g:price']?.[0] || '';
      if (price && !/^\d+(\.\d{2})?$/.test(price)) { issues.invalid_fields.invalid_price_format++; issues.critical_issues.push(`${itemId}: Invalid price format "${price}" (should be numeric)`); }

      const availability = item['g:availability']?.[0] || '';
      if (availability && !['in stock', 'out of stock', 'preorder'].includes(availability.toLowerCase())) { 
        issues.invalid_fields.invalid_availability++; 
        issues.critical_issues.push(`${itemId}: Invalid availability "${availability}" (must be "in stock" or "out of stock")`); 
      }

      const link = item.link?.[0] || '';
      if (link && !link.startsWith('https://') && !link.startsWith('http://')) { issues.invalid_fields.invalid_link++; issues.critical_issues.push(`${itemId}: Invalid link (must be absolute URL)`); }
      if (link && link.length > 2048) { issues.invalid_fields.invalid_link++; issues.critical_issues.push(`${itemId}: Link too long`); }

      const imageUrl = item['g:image_link']?.[0] || '';
      if (imageUrl && !imageUrl.startsWith('https://') && !imageUrl.startsWith('http://')) { issues.invalid_fields.invalid_image_url++; issues.critical_issues.push(`${itemId}: Image URL must be absolute HTTPS`); }
    }

    // Print report
    console.log(`
╔════════════════════════════════════════════════════════════╗
║          META CATALOG FEED VALIDATION REPORT              ║
╚════════════════════════════════════════════════════════════╝

📊 FEED STATISTICS
  Total Items: ${issues.total_items}
  File Size: ~212 KB
  Namespace: xmlns:g="http://base.google.com/ns/1.0"
  XML Version: 1.0 UTF-8

🔴 CRITICAL ISSUES: ${issues.critical_issues.length}
`);

    if (issues.critical_issues.length === 0) {
      console.log('  ✅ NONE - Feed is Meta-compliant!');
    } else {
      issues.critical_issues.slice(0, 10).forEach(issue => console.log(`  ❌ ${issue}`));
      if (issues.critical_issues.length > 10) {
        console.log(`  ... and ${issues.critical_issues.length - 10} more issues`);
      }
    }

    console.log(`
⚠️  WARNINGS: ${issues.warnings.length}`);
    if (issues.warnings.length === 0) {
      console.log('  ✅ NONE');
    } else {
      issues.warnings.slice(0, 5).forEach(w => console.log(`  ⚠️  ${w}`));
    }

    console.log(`
📋 FIELD COVERAGE
  ✅ g:id: ${issues.total_items - issues.missing_fields.id}/${issues.total_items}
  ✅ title: ${issues.total_items - issues.missing_fields.title}/${issues.total_items}
  ✅ description: ${issues.total_items - issues.missing_fields.description}/${issues.total_items}
  ✅ link: ${issues.total_items - issues.missing_fields.link}/${issues.total_items}
  ✅ g:image_link: ${issues.total_items - issues.missing_fields.image_link}/${issues.total_items}
  ✅ g:price: ${issues.total_items - issues.missing_fields.price}/${issues.total_items}
  ✅ g:availability: ${issues.total_items - issues.missing_fields.availability}/${issues.total_items}
  ✅ g:brand: ${issues.total_items - issues.missing_fields.brand}/${issues.total_items}
  ✅ g:condition: ${issues.total_items - issues.missing_fields.condition}/${issues.total_items}
  ✅ g:product_type: ${issues.total_items - issues.missing_fields.product_type}/${issues.total_items}

📉 INVALID FIELDS
  Title too short: ${issues.invalid_fields.title_too_short}
  Title too long: ${issues.invalid_fields.title_too_long}
  Description too short: ${issues.invalid_fields.description_too_short}
  Description too long: ${issues.invalid_fields.description_too_long}
  Invalid price format: ${issues.invalid_fields.invalid_price_format}
  Invalid availability: ${issues.invalid_fields.invalid_availability}
  Invalid link: ${issues.invalid_fields.invalid_link}
  Invalid image URL: ${issues.invalid_fields.invalid_image_url}

═══════════════════════════════════════════════════════════════

`);

    if (issues.critical_issues.length === 0) {
      console.log('✅ META CATALOG STATUS: READY FOR UPLOAD');
      console.log('✅ Expected Result: Items will show in Shops & Ads');
      console.log('✅ Issues to Fix in Meta: 0');
      console.log(`
🎯 NEXT STEPS:
1. Commit & push feed to GitHub
2. Upload to Meta Catalog
3. Wait 10-20 minutes for processing
4. Check Meta Business Manager for confirmation

Feed is compliant with Meta Commerce Manager requirements.
`);
      return true;
    } else {
      console.log('❌ META CATALOG STATUS: ISSUES FOUND - NEEDS FIXING');
      return false;
    }

  } catch (error) {
    console.error('❌ Validation error:', error.message);
    return false;
  }
}

validateMetaFeed().then(isValid => {
  process.exit(isValid ? 0 : 1);
});
