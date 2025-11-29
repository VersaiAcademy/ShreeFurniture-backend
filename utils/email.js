const { Resend } = require('resend');
const { getAdminEmail } = require('../config/emailConfig');

/**
 * Centralized email sender using Resend.
 * Exposes `sendEmail({ to, subject, html })` which returns a structured result
 * and never throws on missing configuration at module load time.
 */

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

const MAIL_FROM = process.env.MAIL_FROM || process.env.FROM_EMAIL || `no-reply@${(process.env.DOMAIN || 'example.com')}`;
const ADMIN_EMAIL = getAdminEmail();

/**
 * Send email using Resend SDK. Returns an object: { success: boolean, data?, error? }
 * Does not throw for common configuration or send failures — callers should inspect the
 * returned object and decide whether to log or ignore failures.
 */
async function sendEmail({ to, subject, html } = {}) {
  if (!to) {
    return { success: false, error: { message: 'Recipient (to) is required' } };
  }
  if (!subject) {
    return { success: false, error: { message: 'Subject is required' } };
  }
  if (!html) {
    return { success: false, error: { message: 'HTML body is required' } };
  }

  const resend = getResendClient();
  if (!resend) {
    const msg = 'RESEND_API_KEY is not configured. Email not sent.';
    console.warn('⚠️', msg);
    // Return structured error but do not throw
    return { success: false, error: { message: msg } };
  }

  if (!MAIL_FROM) {
    const msg = 'MAIL_FROM is not configured. Email not sent.';
    console.warn('⚠️', msg);
    return { success: false, error: { message: msg } };
  }

  try {
    const response = await resend.emails.send({
      from: MAIL_FROM,
      to,
      subject,
      html
    });

    // Resend returns an object; treat missing id as error
    if (!response || !response.id) {
      return { success: false, error: { message: 'Unexpected Resend response', details: response } };
    }

    // Return success with response data
    return { success: true, data: { id: response.id, raw: response } };
  } catch (err) {
    // Return structured error and do not rethrow
    console.error('❌ sendEmail error:', err && err.message ? err.message : err);
    return { success: false, error: { message: err.message || String(err), stack: err.stack } };
  }
}

module.exports = {
  sendEmail,
  MAIL_FROM,
  ADMIN_EMAIL
};
