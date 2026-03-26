// src/routes/assets.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/assets
router.get("/", async (req, res) => {
  try {
    const { category, condition, search } = req.query;
    const campus = req.campus;
    const conditions = ["campus = $1"];
    const params = [campus];
    let i = 2;

    if (category)  { conditions.push(`category = $${i++}`);  params.push(category); }
    if (condition) { conditions.push(`condition = $${i++}`); params.push(condition); }
    if (search)    {
      conditions.push(`name ILIKE $${i++}`);
      params.push(`%${search}%`);
    }

    const result = await pool.query(
      `SELECT a.*, u.full_name AS added_by
       FROM assets a LEFT JOIN users u ON u.id = a.created_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY a.category, a.name`,
      params
    );
    res.json({ assets: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assets
router.post("/", authorize("admin","accountant"), async (req, res) => {
  try {
    const { name, category, condition, location, value, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Asset name is required." });

    // Auto-generate asset ID
    const count = await pool.query(
      `SELECT COUNT(*) FROM assets WHERE campus = $1`, [req.campus]
    );
    const assetId = `AST${String(parseInt(count.rows[0].count) + 1).padStart(3, "0")}`;

    const result = await pool.query(
      `INSERT INTO assets (asset_id, name, category, condition, location, value, campus, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [assetId, name, category || null, condition || "Good",
       location || null, value || null, req.campus, notes || null, req.user.id]
    );
    res.status(201).json({ asset: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/assets/:id
router.put("/:id", authorize("admin","accountant"), async (req, res) => {
  try {
    const { name, category, condition, location, value, notes } = req.body;
    const result = await pool.query(
      `UPDATE assets SET
         name = COALESCE($1, name), category = COALESCE($2, category),
         condition = COALESCE($3, condition), location = COALESCE($4, location),
         value = COALESCE($5, value), notes = COALESCE($6, notes)
       WHERE id = $7 AND campus = $8 RETURNING *`,
      [name, category, condition, location, value, notes, req.params.id, req.campus]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Asset not found." });
    res.json({ asset: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assets/:id
router.delete("/:id", authorize("admin"), async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM assets WHERE id = $1 AND campus = $2`, [req.params.id, req.campus]
    );
    res.json({ message: "Asset deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
