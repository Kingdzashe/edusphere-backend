// src/routes/results.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── Grading logic ────────────────────────────────────────────────────────────
function calcGrade(mark, curriculum) {
  if (mark === null || mark === undefined) return null;
  const m = parseFloat(mark);
  if (curriculum === "ZIMSEC_O") {
    if (m >= 75) return "A";
    if (m >= 65) return "B";
    if (m >= 50) return "C";
    if (m >= 40) return "D";
    if (m >= 30) return "E";
    return "U";
  }
  if (curriculum === "ZIMSEC_A") {
    if (m >= 80) return "A";
    if (m >= 70) return "B";
    if (m >= 60) return "C";
    if (m >= 50) return "D";
    if (m >= 40) return "E";
    return "F";
  }
  if (curriculum === "CAMBRIDGE_O" || curriculum === "CAMBRIDGE_A") {
    if (m >= 90) return "A*";
    if (m >= 80) return "A";
    if (m >= 70) return "B";
    if (m >= 60) return "C";
    if (m >= 50) return "D";
    if (m >= 40) return "E";
    if (m >= 30) return "F";
    if (m >= 20) return "G";
    return "U";
  }
  return null;
}

function getRemarks(grade, curriculum) {
  const maps = {
    ZIMSEC_O:    { A:"Distinction",B:"Merit",C:"Credit",D:"Satisfactory",E:"Fail",U:"Unclassified" },
    ZIMSEC_A:    { A:"Excellent",B:"Very Good",C:"Good",D:"Satisfactory",E:"Pass",F:"Fail" },
    CAMBRIDGE_O: { "A*":"Outstanding","A":"Excellent","B":"Very Good","C":"Good","D":"Satisfactory","E":"Pass","F":"Below Pass","G":"Poor","U":"Ungraded" },
    CAMBRIDGE_A: { "A*":"Outstanding","A":"Excellent","B":"Very Good","C":"Good","D":"Satisfactory","E":"Pass","F":"Below Pass","G":"Poor","U":"Ungraded" },
  };
  return maps[curriculum]?.[grade] || "";
}

// ─── GET /api/results ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { term, year, grade, form, report_type = "term_report",
            student_id, search, limit = 60, page = 1 } = req.query;
    const campus = req.campus;
    const conditions = ["s.campus = $1"];
    const params = [campus];
    let i = 2;

    if (term)          { conditions.push(`r.term = $${i++}`);        params.push(term); }
    if (year)          { conditions.push(`r.year = $${i++}`);        params.push(parseInt(year)); }
    if (grade || form) { conditions.push(`s.form = $${i++}`);        params.push(grade || form); }
    if (report_type)   { conditions.push(`r.report_type = $${i++}`); params.push(report_type); }
    if (student_id)    { conditions.push(`r.student_id = $${i++}`);  params.push(student_id); }
    if (search) {
      conditions.push(`(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where  = `WHERE ${conditions.join(" AND ")}`;

    const [data, count] = await Promise.all([
      pool.query(
        `SELECT r.id, r.student_id, r.term, r.year, r.report_type,
                r.mark AS total, r.mark, r.effort, r.class_average,
                r.grade, r.remarks, r.created_at,
                s.first_name, s.last_name, s.form AS student_grade, s.form, s.class AS student_class,
                sub.id AS subject_id, sub.name AS subject_name, sub.curriculum,
                sub.code AS subject_code,
                r.mark AS ca_score, NULL AS exam_score
         FROM results r
         JOIN students s ON s.id = r.student_id
         JOIN subjects sub ON sub.id = r.subject_id
         ${where}
         ORDER BY s.form, s.last_name, sub.name
         LIMIT $${i++} OFFSET $${i++}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM results r JOIN students s ON s.id = r.student_id ${where}`, params),
    ]);

    res.json({
      results: data.rows,
      pagination: {
        total: parseInt(count.rows[0].count),
        page: parseInt(page),
        pages: Math.ceil(parseInt(count.rows[0].count) / parseInt(limit)),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/results/subjects/all ────────────────────────────────────────────
router.get("/subjects/all", async (req, res) => {
  try {
    const { curriculum, form } = req.query;
    let curriculumFilter = curriculum;

    // Auto-determine curriculum from form
    if (form && !curriculum) {
      if (["3C","4C"].includes(form))       curriculumFilter = "CAMBRIDGE_O";
      else if (["5","6"].includes(form))    curriculumFilter = "ZIMSEC_A";
      else                                   curriculumFilter = "ZIMSEC_O";
    }

    const conditions = ["is_active = true"];
    const params = [];
    if (curriculumFilter) {
      conditions.push(`curriculum = $1`);
      params.push(curriculumFilter);
    }

    const result = await pool.query(
      `SELECT id, name, code, curriculum FROM subjects WHERE ${conditions.join(" AND ")} ORDER BY curriculum, name`,
      params
    );
    res.json({ subjects: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/results ────────────────────────────────────────────────────────
router.post("/", authorize("admin","teacher","principal"), async (req, res) => {
  try {
    const {
      studentId, subjectId, term, year, report_type = "term_report",
      mark, caScore, effort, class_average, remarks,
    } = req.body;

    const finalMark = mark || caScore;

    if (!studentId || !subjectId || !term || !year) {
      return res.status(400).json({ error: "Student, subject, term and year are required." });
    }

    // Teacher check — can only enter for their assigned classes
    if (req.user.role === "teacher") {
      const student = await pool.query(`SELECT form FROM students WHERE id = $1`, [studentId]);
      if (!student.rows.length) return res.status(404).json({ error: "Student not found." });

      const assigned = await pool.query(
        `SELECT form FROM teacher_classes WHERE teacher_user_id = $1 AND campus = $2`,
        [req.user.id, req.campus]
      );
      const forms = assigned.rows.map(r => r.form);
      if (!forms.includes(student.rows[0].form)) {
        return res.status(403).json({ error: "You can only enter results for your assigned classes." });
      }
    }

    // Get subject curriculum for auto-grading
    const subjRes = await pool.query(`SELECT curriculum FROM subjects WHERE id = $1`, [subjectId]);
    if (!subjRes.rows.length) return res.status(404).json({ error: "Subject not found." });

    const curriculum = subjRes.rows[0].curriculum;
    const grade = calcGrade(finalMark, curriculum);
    const auto_remarks = remarks || getRemarks(grade, curriculum);

    const result = await pool.query(
      `INSERT INTO results
         (student_id, subject_id, term, year, report_type, mark, effort, class_average, grade, remarks, entered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (student_id, subject_id, term, year, report_type)
       DO UPDATE SET mark=$6, effort=$7, class_average=$8, grade=$9, remarks=$10, updated_at=NOW()
       RETURNING *`,
      [
        studentId, subjectId, term, parseInt(year), report_type,
        finalMark || null, effort || null, class_average || null,
        grade, auto_remarks, req.user.id,
      ]
    );

    res.status(201).json({ result: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/results/:id ─────────────────────────────────────────────────────
router.put("/:id", authorize("admin","teacher","principal"), async (req, res) => {
  try {
    const { mark, caScore, effort, class_average, remarks } = req.body;
    const finalMark = mark || caScore;

    // Get current result + subject curriculum
    const existing = await pool.query(
      `SELECT r.*, sub.curriculum FROM results r JOIN subjects sub ON sub.id = r.subject_id WHERE r.id = $1`,
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Result not found." });

    const curriculum = existing.rows[0].curriculum;
    const newMark  = finalMark !== undefined ? finalMark : existing.rows[0].mark;
    const grade    = calcGrade(newMark, curriculum);
    const auto_remarks = remarks || getRemarks(grade, curriculum);

    const result = await pool.query(
      `UPDATE results SET mark=$1, effort=$2, class_average=$3, grade=$4, remarks=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [newMark, effort || existing.rows[0].effort, class_average || existing.rows[0].class_average,
       grade, auto_remarks, req.params.id]
    );

    res.json({ result: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/results/:id ──────────────────────────────────────────────────
router.delete("/:id", authorize("admin","principal"), async (req, res) => {
  try {
    await pool.query(`DELETE FROM results WHERE id = $1`, [req.params.id]);
    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id) VALUES ($1,'DELETE_RESULT','results',$2)`,
      [req.user.id, req.params.id]
    );
    res.json({ message: "Result deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
