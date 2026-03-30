const express = require("express");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { processInvoices } = require("./fetch_invoices");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const DB_PATH = process.env.DB_PATH
  ? path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.join(__dirname, process.env.DB_PATH)
  : path.join(__dirname, "inventory.db");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

/**
 * GET /api/invoices/:clave
 * Returns a temporary S3 pre-signed URL for the invoice PDF.
 */
app.get("/api/invoices/:clave", (req, res) => {
  const { clave } = req.params;
  const db = new sqlite3.Database(DB_PATH);

  // We specifically look for the PDF version for browser viewing
  const sql = `SELECT s3_key, file_name FROM invoices WHERE clave = ? AND file_name LIKE '%.pdf' LIMIT 1`;

  db.get(sql, [clave], async (err, row) => {
    db.close();
    if (err) return res.status(500).json({ error: "Database error" });
    if (!row)
      return res
        .status(404)
        .json({ error: "Invoice PDF not found for this clave" });

    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: row.s3_key,
      });

      // URL expires in 60 minutes
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      res.json({ clave, url, fileName: row.file_name });
    } catch (s3Err) {
      res.status(500).json({ error: "Failed to generate secure link" });
    }
  });
});

/**
 * POST /api/sync
 * Manually triggers the email processing script.
 */
app.post("/api/sync", async (req, res) => {
  try {
    await processInvoices();
    res.json({ status: "success", message: "Inbox processed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Sync failed", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Invoice API listening at http://localhost:${port}`);
});
