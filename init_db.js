const path = require("path");
const { openDatabase } = require("./db");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { db, dbPath } = openDatabase();

console.log("Database initialized successfully at:", dbPath);

db.close();
