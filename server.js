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

// Open database connection once for the lifecycle of the server
const db = new sqlite3.Database(DB_PATH);

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

/**
 * Middleware to check for a simple API Key
 */
const authenticate = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

/**
 * GET /api/invoices/:clave
 * Returns temporary S3 pre-signed URLs for all files (or a specific type) associated with a clave.
 */
app.get("/api/invoices/:clave", authenticate, (req, res) => {
  const { clave } = req.params;
  const { type } = req.query; // Optional query param: ?type=pdf or ?type=xml

  let sql = `SELECT s3_key, file_name FROM invoices WHERE clave = ?`;
  const params = [clave];

  if (type) {
    sql += ` AND file_name LIKE ?`;
    params.push(`%.${type}`);
  }

  db.all(sql, params, async (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!rows || rows.length === 0)
      return res.status(404).json({ error: "No files found for this clave" });

    try {
      const files = await Promise.all(
        rows.map(async (row) => {
          const command = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: row.s3_key,
          });

          // URL expires in 60 minutes
          const url = await getSignedUrl(s3Client, command, {
            expiresIn: 3600,
          });
          return {
            fileName: row.file_name,
            url: url,
            type: path.extname(row.file_name).toLowerCase().replace(".", ""),
          };
        }),
      );

      res.json({ clave, files });
    } catch (s3Err) {
      res.status(500).json({ error: "Failed to generate secure links" });
    }
  });
});

/**
 * POST /api/sync
 * Manually triggers the email processing script.
 */
app.post("/api/sync", authenticate, async (req, res) => {
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
