// ShreeFurniture-backend/utils/sendMail.js

const nodemailer = require("nodemailer");

let transporter;

/**
 * STEP 1 — Force the project to ALWAYS use the verified sender email
 */
const getVerifiedFromEmail = () => {
  const from =
    process.env.MAIL_FROM || // primary (YOU MUST VERIFY THIS)
    process.env.BREVO_FROM_EMAIL || // fallback
    process.env.EMAIL_FROM;

  if (!from) {
    throw new Error(
      "MAIL_FROM is missing. Set MAIL_FROM to a VERIFIED email address (Brevo → Senders)."
    );
  }

  return from.trim();
};

/**
 * STEP 2 — Proper Brevo transporter Config
 */
const getBrevoConfig = () => {
  const host = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = Number(process.env.BREVO_SMTP_PORT || 587);

  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;

  if (!user || !pass) {
    throw new Error(
      "Missing Brevo SMTP credentials. Must set BREVO_SMTP_USER & BREVO_SMTP_PASS."
    );
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  };
};

/**
 * STEP 3 — Create transporter only once
 */
const bootstrapTransporter = () => {
  if (transporter) return transporter;

  const config = getBrevoConfig();

  console.log("📨 Initializing Brevo SMTP transporter:", {
    host: config.host,
    port: config.port,
    secure: config.secure
  });

  transporter = nodemailer.createTransport(config);
  return transporter;
};

/**
 * STEP 4 — Send Email (main function)
 */
const sendMail = async ({ to, subject, html, text }) => {
  if (!to) throw new Error("No recipient provided");
  if (!subject) throw new Error("No subject provided");
  if (!html && !text) throw new Error("No email body provided");

  try {
    const mailer = bootstrapTransporter();

    const verifiedSender = getVerifiedFromEmail();
    const fromAddress = `"SRI Furniture Village" <${verifiedSender}>`;

    console.log("📧 Sending Email...");
    console.log(" → From:", fromAddress);
    console.log(" → To:", to);
    console.log(" → Subject:", subject);

    const info = await mailer.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, "")
    });

    console.log("✅ Email SENT:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    console.error(err);
    throw err;
  }
};

module.exports = sendMail;
