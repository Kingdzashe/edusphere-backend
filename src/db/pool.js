// src/db/pool.js
const { Pool } = require("pg");

// On Render: DATABASE_URL is injected as an env var directly - no dotenv needed
// On local: dotenv loads it from .env file
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set!");
}

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        host:     process.env.DB_HOST     || "localhost",
        port:     parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME     || "stillwaters_sis",
        user:     process.env.DB_USER     || "postgres",
        password: process.env.DB_PASSWORD || "",
        max:      20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});

pool.query("SELECT NOW()")
  .then(() => console.log("✅ Database connected successfully"))
  .catch(err => console.error("❌ Database connection failed:", err.message));

module.exports = pool;
