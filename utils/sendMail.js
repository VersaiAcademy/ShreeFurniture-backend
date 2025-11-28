const nodemailer = require('nodemailer');

let transporter;

const bootstrapTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new Error('Missing MAIL_USER/MAIL_PASS in environment');
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  return transporter;
};

const sendMail = async ({ to, subject, html, text }) => {
  if (!to) throw new Error('No recipient provided');
  if (!subject) throw new Error('No subject provided');
  if (!html && !text) throw new Error('No email body provided');

  try {
    const mailer = bootstrapTransporter();

    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);
    console.log(`📧 From: ${process.env.MAIL_USER}`);

    const info = await mailer.sendMail({
      from: `"SRI Furniture Village" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Convert HTML to text if text not provided
    });

    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    console.log(`✅ Response: ${info.response}`);
    return info;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    throw error; // Re-throw to let caller handle
  }
};

module.exports = sendMail;
