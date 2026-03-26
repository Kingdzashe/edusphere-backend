// src/routes/teacher-subjects.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── GET /api/teacher-subjects?teacher_id=X ───────────────────────────────────
// Returns all subject+form assignments for a teacher
router.get("/", async (req, res) => {
  try {
    const { teacher_id } = req.query;
    const effectiveTeacherId = teacher_id || (req.user.role === "teacher" ? req.user.id : null);

    if (!effectiveTeacherId) {
      return res.status(400).json({ error: "teacher_id is required." });
    }

    const result = await pool.query(
      `SELECT ts.id, ts.teacher_user_id, ts.subject_id, ts.form, ts.academic_year,
              sub.name AS subject_name, sub.curriculum,
              u.full_name AS teacher_name
       FROM teacher_subjects ts
       JOIN subjects sub ON sub.id = ts.subject_id
       JOIN users u ON u.id = ts.teacher_user_id
       WHERE ts.teacher_user_id = $1 AND ts.campus = $2
       ORDER BY ts.form, sub.name`,
      [effectiveTeacherId, req.campus]
    );

    res.json({ assignments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/teacher-subjects/subjects ──────────────────────────────────────
// Returns all subjects (for the assignment dropdown)
router.get("/subjects", async (req, res) => {
  try {
    const { form } = req.query;
    const conditions = [];
    const params = [];
    let i = 1;

    if (form) {
      // Filter curriculum by form
      let curriculums = ["ZIMSEC_O"];
      if (["3C","4C"].includes(form))   curriculums = ["CAMBRIDGE_O"];
      if (["5","6"].includes(form))      curriculums = ["ZIMSEC_A","CAMBRIDGE_A"];
      const ph = curriculums.map((_,idx)=>`$${i+idx}`).join(",");
      conditions.push(`curriculum IN (${ph})`);
      params.push(...curriculums);
      i += curriculums.length;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT id, name, curriculum FROM subjects ${where} ORDER BY name`,
      params
    );
    res.json({ subjects: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/teacher-subjects ───────────────────────────────────────────────
// Add a subject+form assignment to a teacher
router.post("/", authorize("admin","principal"), async (req, res) => {
  try {
    const { teacher_user_id, subject_id, form, year = 2026 } = req.body;

    if (!teacher_user_id || !subject_id || !form) {
      return res.status(400).json({ error: "Teacher, subject and form are all required." });
    }

    // Verify the user is a teacher
    const userCheck = await pool.query(
      `SELECT role, full_name FROM users WHERE id = $1`, [teacher_user_id]
    );
    if (!userCheck.rows.length) {
      return res.status(404).json({ error: "User not found." });
    }
    if (userCheck.rows[0].role !== "teacher") {
      return res.status(400).json({ error: "User must have the teacher role." });
    }

    const result = await pool.query(
      `INSERT INTO teacher_subjects (teacher_user_id, subject_id, form, campus, academic_year)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (teacher_user_id, subject_id, form, campus, academic_year) DO NOTHING
       RETURNING *`,
      [teacher_user_id, subject_id, form, req.campus, parseInt(year)]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,campus) VALUES ($1,'ASSIGN_TEACHER_SUBJECT','teacher_subjects',$2)`,
      [req.user.id, req.campus]
    );

    res.status(201).json({
      assignment: result.rows[0] || null,
      message: result.rows[0]
        ? `Assignment added successfully.`
        : `This assignment already exists.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/teacher-subjects/:id ─────────────────────────────────────────
// Remove a subject+form assignment from a teacher
router.delete("/:id", authorize("admin","principal"), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM teacher_subjects WHERE id = $1 AND campus = $2 RETURNING *`,
      [req.params.id, req.campus]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Assignment not found." });
    }

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus) VALUES ($1,'REMOVE_TEACHER_SUBJECT','teacher_subjects',$2,$3)`,
      [req.user.id, req.params.id, req.campus]
    );

    res.json({ message: "Assignment removed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
