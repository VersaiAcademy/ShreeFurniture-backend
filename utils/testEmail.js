require("dotenv").config();   // <-- most important
const sendMail = require("./sendMail");

(async () => {
  try {
    const res = await sendMail({
      to: "srifurniturevillageweb@gmail.com",
      subject: "Testing Resend Email",
      html: "<h1>Resend Email working Perfectly!</h1>",
    });

    console.log("Email sent:", res);
  } catch (err) {
    console.error("Email error:", err);
  }
})();
