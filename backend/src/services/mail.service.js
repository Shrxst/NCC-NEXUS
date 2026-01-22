const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
const sendMail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || '"NCC Nexus" <no-reply@nccnexus.com>',
      to,
      subject,
      html,
    });
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    // We don't throw here to prevent crashing the main thread if email fails, 
    // but in a strict transaction, you might want to throw.
    // For now, we log it.
  }
};

module.exports = { sendMail };