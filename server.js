const express = require("express");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const path = require("path");
const { openDatabase } = require("./db");
const { processInvoices } = require("./fetch_invoices");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// Configuration
const S3_BUCKET = process.env.S3_BUCKET_NAME;

const requiredEnv = ["S3_BUCKET_NAME", "AWS_ACCESS_KEY", "AWS_SECRET_KEY"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnv.join(", ")}`,
  );
  process.exit(1);
}

// Open database connection once for the lifecycle of the server
const { db } = openDatabase();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Middleware to check for a simple API Key
 */
const authenticate = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!process.env.API_KEY) {
    console.warn(
      "WARNING: API_KEY is not set in environment variables. Access is unprotected.",
    );
    return next();
  }

  if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

/**
 * GET /api/invoices/:clave
 * Returns temporary S3 pre-signed URLs for all files (or a specific type) associated with a clave.
 */
app.get("/api/invoices/:clave", authenticate, async (req, res) => {
  const { clave } = req.params;
  const { type } = req.query; // Optional query param: ?type=pdf or ?type=xml

  let sql = `SELECT s3_key, file_name FROM invoices WHERE clave = ?`;
  const params = [clave];

  if (type) {
    sql += ` AND file_name LIKE ?`;
    params.push(`%.${type}`);
  }

  try {
    const rows = db.prepare(sql).all(params);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No files found for this clave" });
    }

    const files = await Promise.all(
      rows.map(async (row) => {
        const command = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: row.s3_key,
        });

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
  } catch (err) {
    res
      .status(500)
      .json({ error: "Database or S3 error", details: err.message });
  }
});

/**
 * POST /api/sync
 * Manually triggers the email processing script.
 */
let isSyncing = false;
app.post("/api/sync", authenticate, async (req, res) => {
  if (isSyncing) {
    return res.status(409).json({ error: "Sync already in progress" });
  }

  isSyncing = true;
  try {
    await processInvoices();
    res.json({ status: "success", message: "Inbox processed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Sync failed", details: err.message });
  } finally {
    isSyncing = false;
  }
});

app.listen(port, () => {
  console.log(`Invoice API listening at http://localhost:${port}`);
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  db.close();
  process.exit(0);
});
