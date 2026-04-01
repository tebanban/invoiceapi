const Database = require("better-sqlite3");
const path = require("path");
const { sendReport } = require("./email_alerts");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const DB_PATH = process.env.DB_PATH
  ? path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.join(__dirname, process.env.DB_PATH)
  : path.join(__dirname, "invoiceapi.db");

async function runDailyReport() {
  console.log("Generating daily sync report...");
  const db = new Database(DB_PATH);

  try {
    // Aggregate stats from all runs in the last 24 hours
    const row = db
      .prepare(
        `
      SELECT 
        SUM(scanned_count) as scanned, 
        SUM(retrieved_count) as retrieved 
      FROM sync_history 
      WHERE run_at >= datetime('now', '-1 day')
    `,
      )
      .get();

    const stats = {
      scanned: row.scanned || 0,
      retrieved: row.retrieved || 0,
    };

    await sendReport(stats);
    console.log(
      `Report sent: ${stats.scanned} scanned, ${stats.retrieved} retrieved.`,
    );
  } catch (err) {
    console.error("Failed to generate or send daily report:", err.message);
  } finally {
    db.close();
  }
}

runDailyReport();
