const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function testEmail() {
  console.log("🧪 Testing email configuration...\n");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log("📧 SMTP Configuration:");
  console.log(`   Host: ${process.env.SMTP_HOST}`);
  console.log(`   Port: ${process.env.SMTP_PORT}`);
  console.log(`   Secure: ${process.env.SMTP_SECURE}`);
  console.log(`   User: ${process.env.SMTP_USER}`);
  console.log(`   Recipient: ${process.env.REPORT_RECIPIENT}\n`);

  try {
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("✅ Connection verified!\n");

    console.log("Sending test email...");
    const info = await transporter.sendMail({
      from: `"Invoice System Test" <${process.env.SMTP_USER}>`,
      to: process.env.REPORT_RECIPIENT,
      subject: "🧪 Email Configuration Test - Invoice API",
      text: `This is a test email from your Invoice API email setup.\n\nTimestamp: ${new Date().toISOString()}`,
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email from your Invoice API email setup.</p>
        <p><strong>Status:</strong> ✅ Email sending is working!</p>
        <p><small>Sent at: ${new Date().toLocaleString()}</small></p>
      `,
    });

    console.log("✅ Email sent successfully!\n");
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Response: ${info.response}`);
  } catch (err) {
    console.error("❌ Email test failed:");
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }
}

testEmail();
