const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
if (!BREVO_API_KEY) {
  throw new Error("Missing BREVO_API_KEY in environment variables");
}

const sendMail = async ({ to, subject, html, text }) => {
  try {
    const payload = {
      sender: { name: "SRI Furniture Village", email: "srifurniturevillageweb@gmail.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html || "",
      textContent: text || ""
    };

    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✔ Email sent:", res.data.messageId || res.data);
    return res.data;

  } catch (err) {
    console.error("❌ Email API failed:", err.response?.data || err.message);
    throw err;
  }
};

module.exports = sendMail;
