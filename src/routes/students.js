// src/routes/students.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── GET /api/students/my-children (parent role only) ─────────────────────────
// Returns ONLY the students linked to the logged-in parent via parent_student table
router.get("/my-children", authorize("parent"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, s.form AS grade
       FROM students s
       JOIN parent_student ps ON ps.student_id = s.id
       WHERE ps.parent_user_id = $1
       ORDER BY s.last_name, s.first_name`,
      [req.user.id]
    );
    res.json({ students: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const VALID_FORMS = ["1","2","3C","3Z","4C","4Z","5","6"];

// ─── GET /api/students/my-students ───────────────────────────────────────────
// Returns students in the forms a teacher is assigned to teach.
// Source of truth: teacher_subjects table (explicit admin assignment).
// Fallback: timetable slots (for backwards compat if teacher_subjects is empty).
router.get("/my-students", authorize("teacher","admin","principal"), async (req, res) => {
  try {
    const teacherId = req.user.role === "teacher" ? req.user.id : req.query.teacher_id;
    if (!teacherId) return res.json({ students: [], assignments: [] });

    // 1. Try teacher_subjects first (explicit admin assignments)
    let assignRes = await pool.query(
      `SELECT ts.id, ts.form, ts.subject_id, ts.academic_year,
              sub.name AS subject_name, sub.curriculum
       FROM teacher_subjects ts
       JOIN subjects sub ON sub.id = ts.subject_id
       WHERE ts.teacher_user_id = $1 AND ts.campus = $2
       ORDER BY ts.form, sub.name`,
      [teacherId, req.campus]
    );

    // 2. Fallback to timetable if no explicit assignments yet
    if (!assignRes.rows.length) {
      assignRes = await pool.query(
        `SELECT DISTINCT t.form, t.subject_id,
                sub.name AS subject_name, sub.curriculum
         FROM timetable t
         JOIN subjects sub ON sub.id = t.subject_id
         WHERE t.teacher_user_id = $1 AND t.campus = $2
         ORDER BY t.form, sub.name`,
        [teacherId, req.campus]
      );
    }

    const assignments = assignRes.rows;
    const forms = [...new Set(assignments.map(r => r.form))];

    if (!forms.length) return res.json({ students: [], assignments });

    const placeholders = forms.map((_, i) => `$${i+2}`).join(",");
    const students = await pool.query(
      `SELECT id, student_id, first_name, last_name, form AS grade, form, class,
              status, gender, parent_name, parent_phone, campus
       FROM students
       WHERE campus = $1 AND form IN (${placeholders}) AND status = 'Active'
       ORDER BY form, last_name, first_name`,
      [req.campus, ...forms]
    );

    res.json({ students: students.rows, assignments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/students/search — fast search for dropdown picker ───────────────
router.get("/search", async (req, res) => {
  try {
    const { q, form } = req.query;
    if (!q || q.trim().length < 1) return res.json({ students: [] });

    const campus = req.campus;
    const conditions = ["s.campus = $1", "s.status = 'Active'"];
    const params = [campus];
    let i = 2;

    // Teacher scoping
    if (req.user.role === "teacher") {
      const formsRes = await pool.query(
        `SELECT DISTINCT form FROM teacher_subjects WHERE teacher_user_id = $1 AND campus = $2`,
        [req.user.id, campus]
      );
      const forms = formsRes.rows.map(r => r.form);
      if (!forms.length) return res.json({ students: [] });
      const ph = forms.map((_, idx) => `$${i + idx}`).join(",");
      conditions.push(`s.form IN (${ph})`);
      params.push(...forms);
      i += forms.length;
    }

    if (form) { conditions.push(`s.form = $${i++}`); params.push(form); }

    conditions.push(
      `(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.student_id ILIKE $${i} OR CONCAT(s.last_name,' ',s.first_name) ILIKE $${i} OR CONCAT(s.first_name,' ',s.last_name) ILIKE $${i})`
    );
    params.push(`%${q.trim()}%`); i++;

    const result = await pool.query(
      `SELECT s.id, s.student_id, s.first_name, s.last_name, s.form AS grade, s.form, s.class
       FROM students s
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.last_name, s.first_name
       LIMIT 15`,
      params
    );
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/students ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { search, grade, form, status, teacher_id, page = 1, limit = 20 } = req.query;
    const campus = req.campus;

    const conditions = ["s.campus = $1"];
    const params = [campus];
    let i = 2;

    // If teacher role — scope to their assigned forms (teacher_subjects first, timetable fallback)
    const effectiveTeacherId = teacher_id || (req.user.role === "teacher" ? req.user.id : null);
    if (effectiveTeacherId) {
      // Try teacher_subjects first
      let formsRes = await pool.query(
        `SELECT DISTINCT form FROM teacher_subjects WHERE teacher_user_id = $1 AND campus = $2`,
        [effectiveTeacherId, campus]
      );
      // Fallback to timetable
      if (!formsRes.rows.length) {
        formsRes = await pool.query(
          `SELECT DISTINCT form FROM timetable WHERE teacher_user_id = $1 AND campus = $2`,
          [effectiveTeacherId, campus]
        );
      }
      const forms = formsRes.rows.map(r => r.form);
      if (!forms.length) {
        return res.json({ students: [], pagination: { total:0, page:1, pages:0, limit: parseInt(limit) } });
      }
      const placeholders = forms.map((_, idx) => `$${i+idx}`).join(",");
      conditions.push(`s.form IN (${placeholders})`);
      params.push(...forms);
      i += forms.length;
    }

    if (status)           { conditions.push(`s.status = $${i++}`);    params.push(status); }
    if (grade || form)    { conditions.push(`s.form   = $${i++}`);    params.push(grade || form); }
    if (search) {
      conditions.push(`(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.student_id ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const where  = `WHERE ${conditions.join(" AND ")}`;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT s.id, s.student_id, s.first_name, s.last_name, s.date_of_birth,
                s.gender, s.form AS grade, s.form, s.class, s.campus, s.status,
                s.email, s.phone, s.address, s.transport,
                s.parent_name, s.parent_phone, s.parent_email,
                s.father_name, s.father_phone, s.father_email, s.father_occupation,
                s.mother_name, s.mother_phone, s.mother_email,
                s.emergency_contact, s.emergency_phone,
                s.previous_school, s.enroll_date, s.photo_url, s.created_at
         FROM students s ${where}
         ORDER BY s.form, s.last_name, s.first_name
         LIMIT $${i++} OFFSET $${i++}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM students s ${where}`, params),
    ]);

    res.json({
      students: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
        limit: parseInt(limit),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/students/:id ────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *, form AS grade FROM students WHERE id = $1 AND campus = $2`,
      [req.params.id, req.campus]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Student not found." });
    res.json({ student: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/students ───────────────────────────────────────────────────────
router.post("/", authorize("admin","principal"), async (req, res) => {
  try {
    const {
      firstName, lastName, dateOfBirth, gender, grade, form, class: cls,
      email, phone, address, transport, previousSchool,
      parentName, parentPhone, parentEmail,
      fatherName, fatherPhone, fatherEmail, fatherOccupation,
      motherName, motherPhone, motherEmail,
      emergencyContact, emergencyPhone, status,
    } = req.body;

    const studentForm = form || grade;
    if (!firstName || !lastName || !studentForm) {
      return res.status(400).json({ error: "First name, last name and form are required." });
    }
    if (!VALID_FORMS.includes(studentForm)) {
      return res.status(400).json({ error: `Invalid form. Must be one of: ${VALID_FORMS.join(", ")}` });
    }

    // Auto-generate student ID
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM students WHERE campus = $1`, [req.campus]
    );
    const nextNum = parseInt(countRes.rows[0].count) + 1;
    const studentId = String(nextNum).padStart(4, "0");

    const result = await pool.query(
      `INSERT INTO students
         (student_id, first_name, last_name, date_of_birth, gender, form, class,
          campus, status, email, phone, address, transport, previous_school,
          parent_name, parent_phone, parent_email,
          father_name, father_phone, father_email, father_occupation,
          mother_name, mother_phone, mother_email,
          emergency_contact, emergency_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *, form AS grade`,
      [
        studentId, firstName, lastName, dateOfBirth || null, gender, studentForm, cls || studentForm,
        req.campus, status || "Active", email || null, phone || null, address || null,
        transport || null, previousSchool || null,
        parentName || null, parentPhone || null, parentEmail || null,
        fatherName || null, fatherPhone || null, fatherEmail || null, fatherOccupation || null,
        motherName || null, motherPhone || null, motherEmail || null,
        emergencyContact || null, emergencyPhone || null,
      ]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus,new_data)
       VALUES ($1,'CREATE_STUDENT','students',$2,$3,$4)`,
      [req.user.id, result.rows[0].id, req.campus, JSON.stringify({ name: `${firstName} ${lastName}`, form: studentForm })]
    );

    res.status(201).json({ student: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/students/:id ────────────────────────────────────────────────────
router.put("/:id", authorize("admin","principal","teacher"), async (req, res) => {
  try {
    const { id } = req.params;

    // Teachers can only edit students in their assigned classes
    if (req.user.role === "teacher") {
      const assigned = await pool.query(
        `SELECT form FROM teacher_classes WHERE teacher_user_id = $1 AND campus = $2`,
        [req.user.id, req.campus]
      );
      const assignedForms = assigned.rows.map(r => r.form);
      const student = await pool.query(`SELECT form FROM students WHERE id = $1`, [id]);
      if (!student.rows.length || !assignedForms.includes(student.rows[0].form)) {
        return res.status(403).json({ error: "You can only edit students in your assigned classes." });
      }
    }

    const {
      firstName, lastName, dateOfBirth, gender, grade, form, class: cls,
      email, phone, address, transport, previousSchool, status,
      parentName, parentPhone, parentEmail,
      fatherName, fatherPhone, fatherEmail, fatherOccupation,
      motherName, motherPhone, motherEmail,
      emergencyContact, emergencyPhone,
    } = req.body;

    const studentForm = form || grade;
    if (studentForm && !VALID_FORMS.includes(studentForm)) {
      return res.status(400).json({ error: `Invalid form. Must be one of: ${VALID_FORMS.join(", ")}` });
    }

    const result = await pool.query(
      `UPDATE students SET
         first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
         date_of_birth = COALESCE($3, date_of_birth), gender = COALESCE($4, gender),
         form = COALESCE($5, form), class = COALESCE($6, class),
         status = COALESCE($7, status), email = COALESCE($8, email),
         phone = COALESCE($9, phone), address = COALESCE($10, address),
         transport = COALESCE($11, transport), previous_school = COALESCE($12, previous_school),
         parent_name = COALESCE($13, parent_name), parent_phone = COALESCE($14, parent_phone),
         parent_email = COALESCE($15, parent_email),
         father_name = COALESCE($16, father_name), father_phone = COALESCE($17, father_phone),
         father_email = COALESCE($18, father_email), father_occupation = COALESCE($19, father_occupation),
         mother_name = COALESCE($20, mother_name), mother_phone = COALESCE($21, mother_phone),
         mother_email = COALESCE($22, mother_email),
         emergency_contact = COALESCE($23, emergency_contact), emergency_phone = COALESCE($24, emergency_phone),
         updated_at = NOW()
       WHERE id = $25 AND campus = $26
       RETURNING *, form AS grade`,
      [
        firstName, lastName, dateOfBirth || null, gender, studentForm, cls,
        status, email, phone, address, transport, previousSchool,
        parentName, parentPhone, parentEmail,
        fatherName, fatherPhone, fatherEmail, fatherOccupation,
        motherName, motherPhone, motherEmail,
        emergencyContact, emergencyPhone,
        id, req.campus,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Student not found." });

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus) VALUES ($1,'UPDATE_STUDENT','students',$2,$3)`,
      [req.user.id, id, req.campus]
    );

    res.json({ student: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/students/:id  (admin only) ────────────────────────────────────
router.delete("/:id", authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const student = await pool.query(`SELECT first_name, last_name, form FROM students WHERE id = $1`, [id]);
    if (!student.rows.length) return res.status(404).json({ error: "Student not found." });

    await pool.query(`DELETE FROM students WHERE id = $1 AND campus = $2`, [id, req.campus]);

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus,old_data)
       VALUES ($1,'DELETE_STUDENT','students',$2,$3,$4)`,
      [req.user.id, id, req.campus, JSON.stringify(student.rows[0])]
    );

    res.json({ message: "Student record deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
