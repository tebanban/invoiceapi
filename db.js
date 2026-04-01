const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function getDbPath() {
  return process.env.DB_PATH
    ? path.isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : path.join(__dirname, process.env.DB_PATH)
    : path.join(__dirname, "invoiceapi.db");
}

function ensureDbDirectory(dbPath) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function ensureSchema(db) {
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

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      scanned_count INTEGER,
      retrieved_count INTEGER
    );
  `);
}

function openDatabase() {
  const dbPath = getDbPath();
  ensureDbDirectory(dbPath);
  const db = new Database(dbPath);
  ensureSchema(db);
  return { db, dbPath };
}

module.exports = {
  ensureSchema,
  getDbPath,
  openDatabase,
};
