/**
 * Email Testing Utility
 * Run this to test if email configuration is working
 * 
 * Usage: node utils/testEmail.js
 */

require('dotenv').config();
const sendMail = require('./sendMail');

const getAdminEmail = () =>
  process.env.ADMIN_EMAIL ||
  process.env.MAIL_TO_ADMIN ||
  process.env.BREVO_FROM_EMAIL ||
  process.env.BREVO_SMTP_USER;

async function testEmail() {
  console.log('🧪 Testing Email Configuration...\n');
  
  const adminEmail = getAdminEmail();
  const smtpHost =
    process.env.BREVO_SMTP_HOST ||
    process.env.EMAIL_SMTP_HOST ||
    'smtp-relay.brevo.com';
  const smtpPort =
    process.env.BREVO_SMTP_PORT ||
    process.env.EMAIL_SMTP_PORT ||
    '587';
  const smtpUser =
    process.env.BREVO_SMTP_USER ||
    process.env.EMAIL_SMTP_USER ||
    process.env.MAIL_USER;
  const smtpPass =
    process.env.BREVO_SMTP_PASS ||
    process.env.EMAIL_SMTP_PASS ||
    process.env.MAIL_PASS;
  
  console.log('📋 Environment Check:');
  console.log('  BREVO_SMTP_HOST:', smtpHost);
  console.log('  BREVO_SMTP_PORT:', smtpPort);
  console.log('  BREVO_SMTP_USER:', smtpUser ? '✅ Set' : '❌ Missing');
  console.log('  BREVO_SMTP_PASS:', smtpPass ? '✅ Set' : '❌ Missing');
  console.log('  ADMIN_EMAIL:', adminEmail || '❌ Not configured');
  
  if (!adminEmail) {
    console.error('\n❌ Cannot test: ADMIN_EMAIL not configured');
    console.error('   Set ADMIN_EMAIL or MAIL_TO_ADMIN in .env file');
    process.exit(1);
  }
  
  if (!smtpUser || !smtpPass) {
    console.error('\n❌ Cannot test: Brevo SMTP credentials missing');
    console.error('   Set BREVO_SMTP_USER and BREVO_SMTP_PASS in .env file');
    process.exit(1);
  }
  
  console.log('\n📧 Sending test email via Brevo...\n');
  
  try {
    await sendMail({
      to: adminEmail,
      subject: 'Test Email - Shree Furniture (Brevo)',
      html: `
        <h2>Email Test Successful! ✅</h2>
        <p>This is a test email from Shree Furniture backend.</p>
        <p>If you received this, your email configuration is working correctly.</p>
        <hr>
        <p><small>Sent at: ${new Date().toLocaleString('en-IN')}</small></p>
      `,
      text: 'Email Test Successful! This is a test email from Shree Furniture backend.'
    });
    
    console.log('\n✅ Test email sent successfully via Brevo!');
    console.log(`✅ Check your inbox at: ${adminEmail}`);
    console.log('✅ If you received the email, your configuration is correct.');
    console.log('✅ If not, check:');
    console.log('   1. Brevo SMTP credentials (user/password) are correct');
    console.log('   2. Brevo account is active and verified');
    console.log('   3. SMTP host/port accessible (default smtp-relay.brevo.com:587)');
    console.log('   4. Check spam folder');
    
  } catch (error) {
    console.error('\n❌ Test email failed!');
    console.error('❌ Error:', error.message);
    console.error('\n📋 Common Issues:');
    console.error('   1. Wrong Brevo SMTP credentials');
    console.error('   2. Brevo account limitations (daily quota, verification)');
    console.error('   3. SMTP port blocked by firewall/provider');
    console.error('   4. Incorrect SMTP host/port settings');
    console.error('\n📋 Error Details:');
    console.error('   Code:', error.code);
    console.error('   Command:', error.command);
    console.error('   Response:', error.response);
    process.exit(1);
  }
}

testEmail();

