const path = require("path");
const { openDatabase } = require("./db");
const { sendReport } = require("./email_alerts");

require("dotenv").config({ path: path.join(__dirname, ".env") });

async function runDailyReport() {
  console.log("Generating daily sync report...");
  const { db } = openDatabase();

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
