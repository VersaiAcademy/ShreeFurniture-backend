/**
 * Email Testing Utility
 * Run this to test if email configuration is working
 * 
 * Usage: node utils/testEmail.js
 */

require('dotenv').config();
const sendMail = require('./sendMail');

const ADMIN_EMAIL = process.env.MAIL_TO_ADMIN || process.env.MAIL_USER;

async function testEmail() {
  console.log('🧪 Testing Email Configuration...\n');
  
  // Check environment variables
  console.log('📋 Environment Check:');
  console.log('  MAIL_USER:', process.env.MAIL_USER ? '✅ Set' : '❌ Missing');
  console.log('  MAIL_PASS:', process.env.MAIL_PASS ? '✅ Set' : '❌ Missing');
  console.log('  MAIL_TO_ADMIN:', process.env.MAIL_TO_ADMIN || 'Not set (using MAIL_USER)');
  console.log('  Admin Email:', ADMIN_EMAIL || '❌ Not configured\n');
  
  if (!ADMIN_EMAIL) {
    console.error('❌ Cannot test: ADMIN_EMAIL not configured');
    console.error('   Set MAIL_TO_ADMIN or MAIL_USER in .env file');
    process.exit(1);
  }
  
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.error('❌ Cannot test: MAIL_USER or MAIL_PASS missing');
    process.exit(1);
  }
  
  console.log('\n📧 Sending test email...\n');
  
  try {
    await sendMail({
      to: ADMIN_EMAIL,
      subject: 'Test Email - Shree Furniture',
      html: `
        <h2>Email Test Successful! ✅</h2>
        <p>This is a test email from Shree Furniture backend.</p>
        <p>If you received this, your email configuration is working correctly.</p>
        <hr>
        <p><small>Sent at: ${new Date().toLocaleString('en-IN')}</small></p>
      `,
      text: 'Email Test Successful! This is a test email from Shree Furniture backend.'
    });
    
    console.log('\n✅ Test email sent successfully!');
    console.log(`✅ Check your inbox at: ${ADMIN_EMAIL}`);
    console.log('✅ If you received the email, your configuration is correct.');
    console.log('✅ If not, check:');
    console.log('   1. Gmail App Password is correct');
    console.log('   2. Less secure app access (if using regular password)');
    console.log('   3. Check spam folder');
    console.log('   4. Check server logs for detailed error messages');
    
  } catch (error) {
    console.error('\n❌ Test email failed!');
    console.error('❌ Error:', error.message);
    console.error('\n📋 Common Issues:');
    console.error('   1. Gmail App Password incorrect');
    console.error('   2. 2FA not enabled (required for App Passwords)');
    console.error('   3. "Less secure app access" disabled (if using regular password)');
    console.error('   4. Network/firewall blocking SMTP');
    console.error('\n📋 Error Details:');
    console.error('   Code:', error.code);
    console.error('   Command:', error.command);
    console.error('   Response:', error.response);
    process.exit(1);
  }
}

testEmail();

