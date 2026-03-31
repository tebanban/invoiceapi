const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config();

const DB_PATH = process.env.DB_PATH || "inventory.db";
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // Main invoices table
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    clave TEXT,
    s3_key TEXT,
    file_name TEXT,
    created_at DATETIME,
    PRIMARY KEY (clave, file_name)
  )`);

  // Tracking table for processed emails
  db.run(`CREATE TABLE IF NOT EXISTS processed_emails (
    message_id TEXT PRIMARY KEY,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log("Database initialized successfully.");
});

db.close();
