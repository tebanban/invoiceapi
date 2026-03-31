const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const DB_PATH = process.env.DB_PATH
  ? path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.join(__dirname, process.env.DB_PATH)
  : path.join(__dirname, "invoiceapi.db");

// Ensure the directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
        clave TEXT NOT NULL,
        s3_key TEXT NOT NULL,
        file_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (clave, file_name)
    );

    CREATE TABLE IF NOT EXISTS processed_emails (
        message_id TEXT PRIMARY KEY,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

console.log("Database initialized successfully at:", DB_PATH);

db.close();
