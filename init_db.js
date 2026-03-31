const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const DB_PATH = process.env.DB_PATH
  ? path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.join(__dirname, process.env.DB_PATH)
  : path.join(__dirname, "invoicemail.db");

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.exec(
    `
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
    `,
    (err) => {
      if (err) {
        console.error("Error creating table:", err.message);
      } else {
        console.log("Database initialized successfully at:", DB_PATH);
      }
    },
  );
});

db.close();
