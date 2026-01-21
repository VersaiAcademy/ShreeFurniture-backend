#!/usr/bin/env node

/**
 * Meta Feed Verification Script
 * Checks if the Meta feed infrastructure is set up correctly
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 META FEED SETUP VERIFICATION\n');

const checks = [];

// Check 1: generate-meta-feed.js exists
const scriptPath = path.join(__dirname, 'generate-meta-feed.js');
const scriptExists = fs.existsSync(scriptPath);
checks.push({
  name: 'generate-meta-feed.js exists',
  status: scriptExists,
  path: scriptPath
});

// Check 2: package.json has npm script
const packagePath = path.join(__dirname, 'package.json');
let hasScript = false;
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  hasScript = pkg.scripts && pkg.scripts['generate-meta-feed'] === 'node generate-meta-feed.js';
}
checks.push({
  name: 'npm script "generate-meta-feed" in package.json',
  status: hasScript,
  path: packagePath
});

// Check 3: .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);
checks.push({
  name: '.env file exists',
  status: envExists,
  path: envPath,
  warning: !envExists ? 'MONGO_URI must be in .env' : null
});

// Check 4: public folder exists
const publicPath = path.join(__dirname, '../frontend/public');
const publicExists = fs.existsSync(publicPath);
checks.push({
  name: 'frontend/public/ directory exists',
  status: publicExists,
  path: publicPath,
  warning: !publicExists ? 'Will be created when script runs' : null
});

// Check 5: Product model exists
const modelPath = path.join(__dirname, 'models/Product.js');
const modelExists = fs.existsSync(modelPath) || fs.existsSync(path.join(__dirname, 'models/index.js'));
checks.push({
  name: 'Product model exists',
  status: modelExists,
  path: modelPath,
  warning: !modelExists ? 'Check models/ folder structure' : null
});

// Print results
console.log('📋 VERIFICATION RESULTS\n');
console.log('┌─────────────────────────────────────────────────────────┐');

checks.forEach((check, index) => {
  const icon = check.status ? '✅' : '❌';
  console.log(`│ ${icon} ${check.name}`);
  if (check.warning) {
    console.log(`│    ⚠️  ${check.warning}`);
  }
});

console.log('└─────────────────────────────────────────────────────────┘\n');

// Summary
const allGood = checks.every(c => c.status);
if (allGood) {
  console.log('✅ ALL CHECKS PASSED\n');
  console.log('🚀 Ready to run: npm run generate-meta-feed\n');
} else {
  console.log('⚠️  SOME CHECKS FAILED\n');
  console.log('❌ Failed checks:');
  checks.filter(c => !c.status).forEach(c => {
    console.log(`   • ${c.name}`);
    console.log(`     Path: ${c.path}`);
  });
  console.log('\n💡 Fix these issues before running the generator.\n');
}

// Additional info
console.log('📝 NEXT STEPS:\n');
console.log('1. Ensure .env has MONGO_URI');
console.log('2. Run: npm run generate-meta-feed');
console.log('3. Check: frontend/public/meta-product-feed.xml');
console.log('4. Deploy to production');
console.log('5. Test: https://srifurniturevillage.com/meta-product-feed.xml\n');
