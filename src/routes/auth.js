// src/routes/auth.js
const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const pool     = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password, campus } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1 AND is_active = true`,
      [username]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid username or password." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password." });

    // Check campus match (admin can log into any campus)
    if (campus && user.role !== "admin" && user.campus !== campus) {
      return res.status(401).json({ error: `Your account is not registered for this campus.` });
    }

    // Check approval (teachers and parents need admin approval)
    if (!user.is_approved) {
      return res.status(403).json({
        error: "Your account is pending approval by the administrator. Please contact the school office."
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, campus: user.campus || campus },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    // Log the login
    await pool.query(
      `INSERT INTO audit_log (user_id, action, campus) VALUES ($1, 'LOGIN', $2)`,
      [user.id, campus || user.campus]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        campus: user.campus,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login." });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, email, role, campus, is_approved
       FROM users WHERE id = $1`, [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "User not found." });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/change-password ────────────────────────────────────────────
router.put("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both current and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    const result = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const valid  = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect." });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, req.user.id]);

    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name) VALUES ($1, 'CHANGE_PASSWORD', 'users')`,
      [req.user.id]
    );
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/users  (admin only) ────────────────────────────────────────
router.get("/users", authenticate, authorize("admin","principal"), async (req, res) => {
  try {
    const { campus, role, approved } = req.query;
    const conditions = [];
    const params = [];
    let i = 1;

    // Non-admin sees only their campus
    if (req.user.role !== "admin") {
      conditions.push(`campus = $${i++}`); params.push(req.campus);
    } else if (campus) {
      conditions.push(`campus = $${i++}`); params.push(campus);
    }
    if (role)    { conditions.push(`role = $${i++}`);       params.push(role); }
    if (approved !== undefined) {
      conditions.push(`is_approved = $${i++}`);
      params.push(approved === "true");
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT id, username, full_name, email, role, campus, is_approved, is_active, created_at
       FROM users ${where} ORDER BY role, full_name`,
      params
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/users  (admin creates user) ───────────────────────────────
router.post("/users", authenticate, authorize("admin","principal"), async (req, res) => {
  try {
    const { username, password, full_name, email, role, campus, is_approved } = req.body;
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ error: "Username, password, full name and role are required." });
    }
    // If admin/principal explicitly sets is_approved=true, honour it (e.g. creating parent at enrolment)
    // Otherwise: admin/principal/accountant auto-approved; teachers/parents need approval
    let approved;
    if (is_approved === true || is_approved === "true") {
      approved = true;
    } else {
      approved = ["admin","principal","accountant"].includes(role);
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username,password_hash,full_name,email,role,campus,is_approved)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, username, full_name, email, role, campus, is_approved`,
      [username, hash, full_name, email || null, role, campus || "swla", approved]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus) VALUES ($1,'CREATE_USER','users',$2,$3)`,
      [req.user.id, result.rows[0].id, campus || "swla"]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Username already exists. Please choose a different username." });
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/link-parent  (link parent user to student) ────────────────
router.post("/link-parent", authenticate, authorize("admin","principal"), async (req, res) => {
  try {
    const { parentUserId, studentId } = req.body;
    if (!parentUserId || !studentId) {
      return res.status(400).json({ error: "Parent user ID and student ID are required." });
    }
    // Verify parent user exists and has role=parent
    const userCheck = await pool.query(`SELECT role FROM users WHERE id = $1`, [parentUserId]);
    if (!userCheck.rows.length) return res.status(404).json({ error: "Parent user not found." });
    if (userCheck.rows[0].role !== "parent") return res.status(400).json({ error: "User is not a parent role." });

    const result = await pool.query(
      `INSERT INTO parent_student (parent_user_id, student_id, relationship)
       VALUES ($1, $2, 'Parent/Guardian')
       ON CONFLICT (parent_user_id, student_id) DO NOTHING
       RETURNING *`,
      [parentUserId, studentId]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,campus) VALUES ($1,'LINK_PARENT_STUDENT','parent_student',$2)`,
      [req.user.id, req.campus]
    );

    res.status(201).json({ link: result.rows[0], message: "Parent linked to student successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/users/:id  (admin: full user profile) ─────────────────────
router.get("/users/:id", authenticate, authorize("admin","principal"), async (req, res) => {
  try {
    const { id } = req.params;
    const userRes = await pool.query(
      `SELECT id, username, full_name, email, role, campus, is_approved, is_active, created_at
       FROM users WHERE id = $1`, [id]
    );
    if (!userRes.rows.length) return res.status(404).json({ error: "User not found." });
    const u = userRes.rows[0];

    // For teachers: get their explicit subject assignments AND timetable slots
    let subjectAssignments = [];
    let timetable = [];
    if (u.role === "teacher") {
      const saRes = await pool.query(
        `SELECT ts.id, ts.form, ts.subject_id, ts.academic_year,
                sub.name AS subject_name, sub.curriculum
         FROM teacher_subjects ts
         JOIN subjects sub ON sub.id = ts.subject_id
         WHERE ts.teacher_user_id = $1
         ORDER BY ts.form, sub.name`,
        [id]
      );
      subjectAssignments = saRes.rows;

      const ttRes = await pool.query(
        `SELECT t.form, t.day, t.period, t.room, t.time_start, t.time_end,
                sub.name AS subject_name, sub.curriculum
         FROM timetable t
         LEFT JOIN subjects sub ON sub.id = t.subject_id
         WHERE t.teacher_user_id = $1
         ORDER BY t.form, t.day, t.period`,
        [id]
      );
      timetable = ttRes.rows;
    }

    // For parents: get their linked children
    let children = [];
    if (u.role === "parent") {
      const childRes = await pool.query(
        `SELECT s.id, s.student_id, s.first_name, s.last_name, s.form AS grade, s.class, s.status
         FROM students s
         JOIN parent_student ps ON ps.student_id = s.id
         WHERE ps.parent_user_id = $1
         ORDER BY s.last_name, s.first_name`,
        [id]
      );
      children = childRes.rows;
    }

    res.json({ user: u, subjectAssignments, timetable, children });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/users/:id  (admin edits any user) ─────────────────────────
router.put("/users/:id", authenticate, authorize("admin","principal"), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, username, role, campus, is_approved, newPassword } = req.body;

    // Build dynamic update
    const updates = [];
    const params  = [];
    let i = 1;

    if (full_name   != null) { updates.push(`full_name = $${i++}`);   params.push(full_name); }
    if (email       != null) { updates.push(`email = $${i++}`);       params.push(email || null); }
    if (username    != null) { updates.push(`username = $${i++}`);    params.push(username); }
    if (role        != null) { updates.push(`role = $${i++}`);        params.push(role); }
    if (campus      != null) { updates.push(`campus = $${i++}`);      params.push(campus); }
    if (is_approved != null) { updates.push(`is_approved = $${i++}`); params.push(is_approved); }

    if (newPassword) {
      if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
      const hash = await bcrypt.hash(newPassword, 10);
      updates.push(`password_hash = $${i++}`);
      params.push(hash);
    }

    if (!updates.length) return res.status(400).json({ error: "No fields to update." });

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${i}
       RETURNING id, username, full_name, email, role, campus, is_approved`,
      params
    );

    if (!result.rows.length) return res.status(404).json({ error: "User not found." });

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id) VALUES ($1,'EDIT_USER','users',$2)`,
      [req.user.id, id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Username already taken." });
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/users/:id/approve  (admin approves account) ────────────────
router.put("/users/:id/approve", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    await pool.query(
      `UPDATE users SET is_approved = $1, updated_at = NOW() WHERE id = $2`,
      [approved !== false, id]
    );
    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id) VALUES ($1,'APPROVE_USER','users',$2)`,
      [req.user.id, id]
    );
    res.json({ message: approved !== false ? "Account approved." : "Account suspended." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/auth/users/:id  (admin only) ─────────────────────────────────
router.delete("/users/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account." });
    }
    await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [id]);
    res.json({ message: "User deactivated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
