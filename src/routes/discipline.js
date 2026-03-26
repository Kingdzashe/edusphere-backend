// src/routes/discipline.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── GET /api/discipline ──────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { student_id, status, limit = 50 } = req.query;
    const campus = req.campus;
    const conditions = ["d.campus = $1"];
    const params = [campus];
    let i = 2;

    if (student_id) { conditions.push(`d.student_id = $${i++}`); params.push(student_id); }
    if (status)     { conditions.push(`d.status = $${i++}`);     params.push(status); }

    const result = await pool.query(
      `SELECT d.*, s.first_name, s.last_name, s.form, s.class,
              u.full_name AS reported_by_name
       FROM discipline d
       LEFT JOIN students s ON s.id = d.student_id
       LEFT JOIN users u ON u.id = d.reported_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY d.date DESC, d.created_at DESC
       LIMIT $${i}`,
      [...params, parseInt(limit)]
    );
    res.json({ incidents: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/discipline ─────────────────────────────────────────────────────
router.post("/", authorize("admin","principal","teacher"), async (req, res) => {
  try {
    const {
      student_id, incident_type, description,
      severity = "Low", action_taken, fine_amount = 0, date
    } = req.body;

    if (!student_id || !incident_type) {
      return res.status(400).json({ error: "Student and incident type are required." });
    }

    // Auto-generate incident ID
    const count = await pool.query(
      `SELECT COUNT(*) FROM discipline WHERE campus = $1`, [req.campus]
    );
    const incidentId = `INC${String(parseInt(count.rows[0].count) + 1).padStart(3, "0")}`;

    const result = await pool.query(
      `INSERT INTO discipline
         (incident_id, student_id, incident_type, description, severity,
          action_taken, fine_amount, status, date, reported_by, campus)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Open',$8,$9,$10)
       RETURNING *`,
      [
        incidentId, student_id, incident_type, description || null,
        severity, action_taken || null, fine_amount,
        date || new Date().toISOString().split("T")[0],
        req.user.id, req.campus,
      ]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus)
       VALUES ($1,'CREATE_INCIDENT','discipline',$2,$3)`,
      [req.user.id, result.rows[0].id, req.campus]
    );

    res.status(201).json({ incident: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/discipline/:id  (resolve / update) ─────────────────────────────
router.put("/:id", authorize("admin","principal","teacher"), async (req, res) => {
  try {
    const { status, action_taken, fine_amount } = req.body;
    const result = await pool.query(
      `UPDATE discipline SET
         status       = COALESCE($1, status),
         action_taken = COALESCE($2, action_taken),
         fine_amount  = COALESCE($3, fine_amount)
       WHERE id = $4 AND campus = $5
       RETURNING *`,
      [status, action_taken, fine_amount, req.params.id, req.campus]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Incident not found." });
    res.json({ incident: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
