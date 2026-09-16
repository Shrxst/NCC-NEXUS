const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
const sendMail = async ({ to, subject, html }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "NCC Nexus <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Resend email error:", error);
      return null;
    }

    console.log("Message sent:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    return null;
  }
};

module.exports = { sendMail };