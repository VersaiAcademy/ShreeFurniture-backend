const { Resend } = require('resend');

// Validate required environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM;

if (!RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set in environment variables. Please configure it.');
}

if (!MAIL_FROM) {
  throw new Error('MAIL_FROM is not set in environment variables. Please configure it.');
}

const resend = new Resend(RESEND_API_KEY);

/**
 * Send email using Resend
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML email body
 * @param {string} [params.replyTo] - Reply-To email (note: Resend doesn't support replyTo, will be ignored)
 * @returns {Promise} Resend API response
 */
const sendMail = async ({ to, subject, html, replyTo } = {}) => {
  if (!to) throw new Error('Email recipient (to) is required');
  if (!subject) throw new Error('Email subject is required');
  if (!html) throw new Error('Email HTML content is required');

  try {
    // Note: replyTo is not supported by Resend, but we accept it for future compatibility
    if (replyTo) {
      console.warn('⚠️ Note: replyTo is not supported by Resend and will be ignored.');
    }

    const response = await resend.emails.send({
      from: MAIL_FROM,
      to,
      subject,
      html,
    });

    if (response.error) {
      console.error('❌ Resend API error:', response.error);
      throw new Error(`Resend error: ${response.error.message || JSON.stringify(response.error)}`);
    }

    console.log(`✅ Email sent successfully to ${to}. Message ID: ${response.id}`);
    return response;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message || error);
    throw error;
  }
};

module.exports = sendMail;
