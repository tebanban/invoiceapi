const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Ensure .env is loaded from the script's directory
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Configuration
const IMAP_CONFIG = {
  host: process.env.IMAP_SERVER || "imap.dreamhost.com",
  port: 993,
  secure: true,
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASS,
  },
  logger: false,
};

const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_PREFIX = process.env.S3_PATH_PREFIX
  ? `${process.env.S3_PATH_PREFIX}/`
  : "";

// Resolve DB_PATH relative to the script if it's a relative path
const DB_PATH = process.env.DB_PATH
  ? path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.join(__dirname, process.env.DB_PATH)
  : path.join(__dirname, "invoicemail.db");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

function updateDatabase(db, clave, s3Key, fileName) {
  const sql = `
      INSERT INTO invoices (clave, s3_key, file_name, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(clave, file_name) DO NOTHING
  `;
  db.prepare(sql).run(clave, s3Key, fileName, new Date().toISOString());
  console.log(`Index updated for Clave: ${clave}`);
}

function isEmailProcessed(db, messageId) {
  const row = db
    .prepare("SELECT 1 FROM processed_emails WHERE message_id = ?")
    .get(messageId);
  return !!row;
}

function markEmailAsProcessed(db, messageId) {
  db.prepare("INSERT INTO processed_emails (message_id) VALUES (?)").run(
    messageId,
  );
}

function extractClave(content, filename) {
  if (content) {
    const match = content.toString("utf-8").match(/>(\d{50})</);
    if (match) return match[1];
  }
  const nameMatch = (filename || "").match(/(\d{50})/);
  return nameMatch ? nameMatch[1] : null;
}

async function processInvoices() {
  const client = new ImapFlow(IMAP_CONFIG);

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  console.log(`Connecting to ${IMAP_CONFIG.host}...`);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    const RETRIEVAL_DAYS = parseInt(process.env.RETRIEVAL_DAYS || "1");
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - RETRIEVAL_DAYS);
    console.log(
      `Searching for all emails received since: ${sinceDate.toDateString()}`,
    );

    try {
      // Search and fetch ALL messages within the recent window (ignoring seen/unseen)
      let totalFound = 0;
      let totalRetrieved = 0;
      for await (let message of client.fetch(
        { since: sinceDate },
        { source: true },
      )) {
        totalFound++;
        const parsed = await simpleParser(message.source);
        const messageId = parsed.messageId;
        const subject = parsed.subject || "(No Subject)";
        const from = parsed.from?.text || "(Unknown Sender)";

        console.log(`\n[${totalFound}] Analyzing Message UID: ${message.uid}`);
        console.log(`    From: ${from}`);
        console.log(`    Subject: ${subject}`);

        if (isEmailProcessed(db, messageId)) {
          console.log(`    Status: Skipped (Already in local database)`);
          continue;
        }

        let clave = null;
        const validAttachments = [];

        console.log(`    Attachments found: ${parsed.attachments.length}`);
        for (const att of parsed.attachments) {
          const ext = path.extname(att.filename || "").toLowerCase();
          if (ext === ".xml" || ext === ".pdf") {
            validAttachments.push(att);
            if (!clave) {
              clave = extractClave(
                ext === ".xml" ? att.content : null,
                att.filename || "",
              );
              if (clave) {
                console.log(
                  `    Clave detected: ${clave} (extracted from ${att.filename})`,
                );
              }
            }
          }
        }

        if (clave && validAttachments.length > 0) {
          console.log(
            `    Action: Processing ${validAttachments.length} files...`,
          );
          totalRetrieved++;
          for (const att of validAttachments) {
            const ext = path.extname(att.filename || "").toLowerCase();
            const s3Key = `${S3_PREFIX}${clave}/${att.filename}`;
            console.log(`    - Uploading ${att.filename} to S3...`);

            await s3Client.send(
              new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: att.content, // content is a Buffer from simpleParser
                ContentType: ext === ".pdf" ? "application/pdf" : "text/xml",
              }),
            );

            updateDatabase(db, clave, s3Key, att.filename);
          }

          console.log(`    Result: Successfully processed invoice ${clave}`);
        } else {
          console.log(
            `    Result: Skipped (No 50-digit Clave found in attachments)`,
          );
        }

        // Always mark as processed in our local DB so we don't scan it again
        markEmailAsProcessed(db, messageId);
      }

      // Log synchronization statistics for reporting
      db.prepare(
        "INSERT INTO sync_history (scanned_count, retrieved_count) VALUES (?, ?)",
      ).run(totalFound, totalRetrieved);

      if (totalFound === 0) {
        console.log("\nNo unread emails found matching the criteria.");
      }
    } finally {
      lock.release();
    }

    await client.logout();
    db.close();
  } catch (err) {
    console.error("An error occurred:", err);
    db.close();
    throw err;
  }
}

if (require.main === module) {
  processInvoices();
}

module.exports = { processInvoices };
