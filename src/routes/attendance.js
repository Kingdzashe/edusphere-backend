// src/routes/attendance.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── GET /api/attendance ──────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { date, form, grade, search, student_id, limit = 100 } = req.query;
    const campus = req.campus;
    const conditions = ["s.campus = $1"];
    const params = [campus];
    let i = 2;

    if (date)          { conditions.push(`a.date = $${i++}`);    params.push(date); }
    if (form || grade) { conditions.push(`s.form = $${i++}`);    params.push(form || grade); }
    if (student_id)    { conditions.push(`s.id = $${i++}`);      params.push(student_id); }
    if (search) {
      conditions.push(`(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const result = await pool.query(
      `SELECT a.id, a.date, a.status, a.remarks, a.created_at,
              s.id AS student_id, s.first_name, s.last_name,
              s.form AS grade, s.form, s.class
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       ${where}
       ORDER BY s.form, s.last_name, s.first_name
       LIMIT $${i}`,
      [...params, parseInt(limit)]
    );
    res.json({ attendance: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/attendance/summary ─────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const { date, form, student_id } = req.query;
    const campus = req.campus;
    const targetDate = date || new Date().toISOString().split("T")[0];

    const conditions = ["s.campus = $1", "a.date = $2"];
    const params = [campus, targetDate];
    if (form)       { conditions.push(`s.form = $3`);  params.push(form); }
    if (student_id) { conditions.push(`s.id = $${params.length+1}`); params.push(student_id); }

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE a.status = 'Present') AS present,
         COUNT(*) FILTER (WHERE a.status = 'Absent')  AS absent,
         COUNT(*) AS total,
         ROUND(
           COUNT(*) FILTER (WHERE a.status = 'Present') * 100.0 / NULLIF(COUNT(*), 0), 1
         ) AS rate
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE ${conditions.join(" AND ")}`,
      params
    );
    res.json({ summary: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/attendance/report ───────────────────────────────────────────────
router.get("/report", async (req, res) => {
  try {
    const { form, grade, term } = req.query;
    const campus = req.campus;
    const conditions = ["s.campus = $1"];
    const params = [campus];
    let i = 2;

    if (form || grade) { conditions.push(`s.form = $${i++}`); params.push(form || grade); }

    const result = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.form AS grade, s.form,
              COUNT(a.id) AS total_days,
              COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present_days,
              COUNT(a.id) FILTER (WHERE a.status = 'Absent')  AS absent_days,
              ROUND(
                COUNT(a.id) FILTER (WHERE a.status = 'Present') * 100.0 / NULLIF(COUNT(a.id), 0), 1
              ) AS attendance_rate
       FROM students s
       LEFT JOIN attendance a ON a.student_id = s.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY s.id, s.first_name, s.last_name, s.form
       ORDER BY s.form, attendance_rate ASC`,
      params
    );
    res.json({ report: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/attendance (single) ───────────────────────────────────────────
router.post("/", authorize("admin","teacher","principal"), async (req, res) => {
  try {
    const { studentId, date, status, remarks } = req.body;
    if (!studentId || !date || !status) {
      return res.status(400).json({ error: "Student ID, date and status are required." });
    }
    if (!["Present","Absent"].includes(status)) {
      return res.status(400).json({ error: "Status must be Present or Absent." });
    }

    const result = await pool.query(
      `INSERT INTO attendance (student_id, date, status, remarks, marked_by, campus)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (student_id, date)
       DO UPDATE SET status=$3, remarks=$4, marked_by=$5
       RETURNING *`,
      [studentId, date, status, remarks || null, req.user.id, req.campus]
    );
    res.status(201).json({ attendance: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/attendance/bulk ────────────────────────────────────────────────
router.post("/bulk", authorize("admin","teacher","principal"), async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: "Date and records array are required." });
    }

    let count = 0;
    for (const rec of records) {
      if (!["Present","Absent"].includes(rec.status)) continue;
      await pool.query(
        `INSERT INTO attendance (student_id, date, status, remarks, marked_by, campus)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (student_id, date)
         DO UPDATE SET status=$3, remarks=$4, marked_by=$5`,
        [rec.studentId, date, rec.status, rec.remarks || null, req.user.id, req.campus]
      );
      count++;
    }

    // Log it
    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,campus,new_data)
       VALUES ($1,'BULK_ATTENDANCE','attendance',$2,$3)`,
      [req.user.id, req.campus, JSON.stringify({ date, count })]
    );

    res.json({ message: `Register marked for ${count} learners.`, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/attendance/:id ────────────────────────────────────────────────
router.delete("/:id", authorize("admin"), async (req, res) => {
  try {
    await pool.query(`DELETE FROM attendance WHERE id = $1`, [req.params.id]);
    res.json({ message: "Attendance record deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
