// src/db/pool.js
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const { Pool } = require("pg");

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME     || "stillwaters_sis",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "",
  max:      20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});

// Test connection on startup
pool.query("SELECT NOW()")
  .then(() => console.log("✅ Database connected successfully"))
  .catch(err => console.error("❌ Database connection failed:", err.message));

module.exports = pool;
