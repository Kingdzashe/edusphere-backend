// src/routes/timetable.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const DAYS    = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const PERIODS = [1,2,3,4,5,6,7,8];
const TIMES   = {
  1:{ start:"07:30", end:"08:25" },
  2:{ start:"08:25", end:"09:20" },
  3:{ start:"09:20", end:"10:15" },
  4:{ start:"10:30", end:"11:25" },
  5:{ start:"11:25", end:"12:20" },
  6:{ start:"13:00", end:"13:55" },
  7:{ start:"13:55", end:"14:50" },
  8:{ start:"14:50", end:"15:45" },
};

// ─── GET /api/timetable ───────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { form, teacher_id, day, year = 2026 } = req.query;
    const campus = req.campus;
    const conditions = ["t.campus = $1", "t.academic_year = $2"];
    const params = [campus, parseInt(year)];
    let i = 3;

    if (form)       { conditions.push(`t.form = $${i++}`);              params.push(form); }
    if (teacher_id) { conditions.push(`t.teacher_user_id = $${i++}`);   params.push(teacher_id); }
    if (day)        { conditions.push(`t.day = $${i++}`);               params.push(day); }

    // If teacher role — only show their own timetable
    if (req.user.role === "teacher" && !teacher_id) {
      conditions.push(`t.teacher_user_id = $${i++}`);
      params.push(req.user.id);
    }

    const result = await pool.query(
      `SELECT t.*,
              sub.name AS subject_name, sub.curriculum,
              u.full_name AS teacher_name
       FROM timetable t
       LEFT JOIN subjects sub ON sub.id = t.subject_id
       LEFT JOIN users u ON u.id = t.teacher_user_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.form, t.day, t.period`,
      params
    );
    res.json({ timetable: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/timetable/teachers ─────────────────────────────────────────────
router.get("/teachers", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name FROM users
       WHERE role = 'teacher' AND campus = $1 AND is_active = true
       ORDER BY full_name`,
      [req.campus]
    );
    res.json({ teachers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/timetable/meta ──────────────────────────────────────────────────
router.get("/meta", (_req, res) => {
  res.json({ days: DAYS, periods: PERIODS, times: TIMES });
});

// ─── POST /api/timetable ─────────────────────────────────────────────────────
router.post("/", authorize("admin","principal"), async (req, res) => {
  try {
    const { form, class: cls, day, period, subject_id, teacher_user_id, room, year = 2026 } = req.body;
    if (!form || !day || !period) {
      return res.status(400).json({ error: "Form, day and period are required." });
    }
    if (!DAYS.includes(day)) {
      return res.status(400).json({ error: `Day must be one of: ${DAYS.join(", ")}` });
    }
    if (!PERIODS.includes(parseInt(period))) {
      return res.status(400).json({ error: "Period must be between 1 and 8." });
    }

    const times = TIMES[parseInt(period)];
    const result = await pool.query(
      `INSERT INTO timetable
         (form, class, day, period, subject_id, teacher_user_id, room,
          time_start, time_end, campus, academic_year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (form, day, period, campus, academic_year)
       DO UPDATE SET
         subject_id = $5, teacher_user_id = $6, room = $7,
         time_start = $8, time_end = $9, class = $2
       RETURNING *`,
      [
        form, cls || form, day, parseInt(period),
        subject_id || null, teacher_user_id || null, room || null,
        times.start, times.end, req.campus, parseInt(year),
      ]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,campus) VALUES ($1,'UPSERT_TIMETABLE','timetable',$2)`,
      [req.user.id, req.campus]
    );

    res.status(201).json({ slot: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/timetable/:id ────────────────────────────────────────────────
router.delete("/:id", authorize("admin","principal"), async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM timetable WHERE id = $1 AND campus = $2`,
      [req.params.id, req.campus]
    );
    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus)
       VALUES ($1,'DELETE_TIMETABLE','timetable',$2,$3)`,
      [req.user.id, req.params.id, req.campus]
    );
    res.json({ message: "Timetable slot deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
