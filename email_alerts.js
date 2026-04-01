const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a summary report email.
 * @param {Object} stats - Object containing scanned and retrieved counts.
 */
async function sendReport(stats) {
  const mailOptions = {
    from: `"Invoice System" <${process.env.SMTP_USER}>`,
    to: process.env.REPORT_RECIPIENT,
    subject: `Daily Invoice Sync Report - ${new Date().toLocaleDateString()}`,
    text: `Daily Summary:
    - Total Emails Scanned: ${stats.scanned}
    - Total Invoices Retrieved/Indexed: ${stats.retrieved}
    - Timestamp: ${new Date().toISOString()}`,
    html: `
      <h2>Daily Invoice Sync Report</h2>
      <p>Results for the last 24 hours:</p>
      <ul>
        <li><strong>Total Emails Scanned:</strong> ${stats.scanned}</li>
        <li><strong>Total Invoices Retrieved:</strong> ${stats.retrieved}</li>
      </ul>
      <p><small>Generated at: ${new Date().toLocaleString()}</small></p>`,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendReport };
