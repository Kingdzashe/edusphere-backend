// src/routes/notices.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/notices
router.get("/", async (req, res) => {
  try {
    const campus = req.campus;
    const role   = req.user.role;
    const result = await pool.query(
      `SELECT n.*, u.full_name AS posted_by
       FROM notices n
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.campus = $1 AND n.is_active = true
         AND (n.target_roles = 'all' OR n.target_roles ILIKE $2
              OR $3 = 'admin')
         AND (n.expires_at IS NULL OR n.expires_at > NOW())
       ORDER BY n.created_at DESC`,
      [campus, `%${role}%`, role]
    );
    res.json({ notices: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notices
router.post("/", authorize("admin","principal"), async (req, res) => {
  try {
    const { title, content, target_roles, expires_at } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required." });
    }
    const result = await pool.query(
      `INSERT INTO notices (title, content, campus, target_roles, created_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, content, req.campus, target_roles || "all", req.user.id, expires_at || null]
    );
    res.status(201).json({ notice: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notices/:id
router.delete("/:id", authorize("admin","principal"), async (req, res) => {
  try {
    await pool.query(
      `UPDATE notices SET is_active = false WHERE id = $1 AND campus = $2`,
      [req.params.id, req.campus]
    );
    res.json({ message: "Notice removed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
