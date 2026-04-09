// src/index.js
require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const authRoutes             = require("./routes/auth");
const studentRoutes          = require("./routes/students");
const resultsRoutes          = require("./routes/results");
const attendanceRoutes       = require("./routes/attendance");
const billingRoutes          = require("./routes/billing");
const dashboardRoutes        = require("./routes/dashboard");
const noticesRoutes          = require("./routes/notices");
const assetsRoutes           = require("./routes/assets");
const pdfRoutes              = require("./routes/pdf");
const disciplineRoutes       = require("./routes/discipline");
const timetableRoutes        = require("./routes/timetable");
const teacherSubjectsRoutes  = require("./routes/teacher-subjects");
const hrRoutes               = require("./routes/hr");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`CORS blocked: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path} [${req.headers["x-campus"] || "no-campus"}]`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",             authRoutes);
app.use("/api/students",         studentRoutes);
app.use("/api/results",          resultsRoutes);
app.use("/api/attendance",       attendanceRoutes);
app.use("/api/billing",          billingRoutes);
app.use("/api/dashboard",        dashboardRoutes);
app.use("/api/notices",          noticesRoutes);
app.use("/api/assets",           assetsRoutes);
app.use("/api/pdf",              pdfRoutes);
app.use("/api/discipline",       disciplineRoutes);
app.use("/api/timetable",        timetableRoutes);
app.use("/api/teacher-subjects", teacherSubjectsRoutes);
app.use("/api/hr",               hrRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    system: "Still Waters Group of Schools — SIS API",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🦅 Still Waters SIS API running on http://localhost:${PORT}`);
  console.log(`   Health:      http://localhost:${PORT}/api/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Allowed origins: ${allowedOrigins.join(", ")}\n`);
});
