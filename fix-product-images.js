const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { Product } = require('./models');

const DEFAULT_IMAGE_URL = 'https://via.placeholder.com/400x300?text=No+Image+Available';

async function fixProductImages() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('📦 Fetching products...');
    const products = await Product.find({});
    console.log(`Found ${products.length} products`);

    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      let hasUpdate = false;
      let updateData = {};

      // Check if img1 is missing or empty
      if (!product.img1 || product.img1.trim() === '') {
        // Try to use a variant image as fallback
        let imageFound = false;

        // Try stone finish images
        if (product.stone_finish_image && product.stone_finish_image.trim() !== '') {
          updateData.img1 = product.stone_finish_image;
          imageFound = true;
        }
        // Try natural finish images
        else if (product.natural_finish_image && product.natural_finish_image.trim() !== '') {
          updateData.img1 = product.natural_finish_image;
          imageFound = true;
        }
        // Try other image fields
        else if (product.img2 && product.img2.trim() !== '') {
          updateData.img1 = product.img2;
          imageFound = true;
        }
        else if (product.img3 && product.img3.trim() !== '') {
          updateData.img1 = product.img3;
          imageFound = true;
        }
        else if (product.img4 && product.img4.trim() !== '') {
          updateData.img1 = product.img4;
          imageFound = true;
        }
        else if (product.img5 && product.img5.trim() !== '') {
          updateData.img1 = product.img5;
          imageFound = true;
        }

        // If still no image, use placeholder
        if (!imageFound) {
          updateData.img1 = DEFAULT_IMAGE_URL;
        }

        hasUpdate = true;
      }

      if (hasUpdate) {
        await Product.findByIdAndUpdate(product._id, updateData, { new: true });
        updated++;
        console.log(`✅ Updated: ${product.pname} (ID: ${product._id})`);
      } else {
        skipped++;
      }
    }

    console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log('📊 IMAGE FIX SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Products Updated: ${updated}`);
    console.log(`⏭️  Products Skipped:  ${skipped} (already had img1)`);
    console.log(`📦 Total Processed:   ${products.length}`);
    console.log('═══════════════════════════════════════');

    if (updated > 0) {
      console.log('\n🎯 Now run: npm run generate-meta-feed');
      console.log('📝 This will regenerate the feed with all product images!\n');
    }

    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error fixing images:', error.message);
    process.exit(1);
  }
}

fixProductImages();
