const nodemailer = require('nodemailer');

let transporter;

const getBrevoConfig = () => {
  const host =
    process.env.BREVO_SMTP_HOST ||
    process.env.EMAIL_SMTP_HOST ||
    'smtp-relay.brevo.com';

  const port = Number(
    process.env.BREVO_SMTP_PORT ||
      process.env.EMAIL_SMTP_PORT ||
      587
  );

  const user =
    process.env.BREVO_SMTP_USER ||
    process.env.EMAIL_SMTP_USER ||
    process.env.MAIL_USER; // legacy fallback

  const pass =
    process.env.BREVO_SMTP_PASS ||
    process.env.EMAIL_SMTP_PASS ||
    process.env.MAIL_PASS; // legacy fallback

  if (!user || !pass) {
    throw new Error(
      'Missing Brevo SMTP credentials. Please set BREVO_SMTP_USER and BREVO_SMTP_PASS in .env'
    );
  }

  const secure =
    process.env.BREVO_SMTP_SECURE === 'true' ||
    (process.env.BREVO_SMTP_SECURE !== 'false' && port === 465);

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    defaultFrom:
      process.env.BREVO_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      user
  };
};

const bootstrapTransporter = () => {
  if (transporter) return transporter;

  const { host, port, secure, auth } = getBrevoConfig();

  console.log('📨 Initializing Brevo SMTP transporter', {
    host,
    port,
    secure
  });

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth
  });

  return transporter;
};

const sendMail = async ({ to, subject, html, text }) => {
  if (!to) throw new Error('No recipient provided');
  if (!subject) throw new Error('No subject provided');
  if (!html && !text) throw new Error('No email body provided');

  try {
    const mailer = bootstrapTransporter();
    const { defaultFrom } = getBrevoConfig();
    const fromAddress = `"SRI Furniture Village" <${defaultFrom}>`;

    console.log(`📧 Attempting to send email`);
    console.log(`   → To: ${to}`);
    console.log(`   → From: ${fromAddress}`);
    console.log(`   → Subject: ${subject}`);

    const info = await mailer.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    });

    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    if (info.response) {
      console.log(`✅ SMTP Response: ${info.response}`);
    }
    return info;
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    throw error;
  }
};

module.exports = sendMail;
