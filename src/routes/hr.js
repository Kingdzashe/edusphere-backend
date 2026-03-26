// src/routes/hr.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── GET /api/hr/staff ────────────────────────────────────────────────────────
router.get("/staff", authorize("admin","principal","accountant"), async (req, res) => {
  try {
    const { search, department, employment_type, status } = req.query;
    const campus = req.campus;

    const conditions = ["s.campus = $1"];
    const params     = [campus];
    let i = 2;

    if (status)          { conditions.push(`s.employment_status = $${i++}`); params.push(status); }
    if (department)      { conditions.push(`s.department = $${i++}`);        params.push(department); }
    if (employment_type) { conditions.push(`s.employment_type = $${i++}`);   params.push(employment_type); }
    if (search) {
      conditions.push(`(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.employee_id ILIKE $${i} OR s.job_title ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const result = await pool.query(
      `SELECT s.*, u.username, u.email AS login_email, u.role AS system_role
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.last_name, s.first_name`,
      params
    );
    res.json({ staff: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/hr/staff/:id ────────────────────────────────────────────────────
router.get("/staff/:id", authorize("admin","principal","accountant"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.username, u.email AS login_email, u.role AS system_role
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Staff member not found." });

    // Get leave records
    const leave = await pool.query(
      `SELECT * FROM staff_leave WHERE staff_id = $1 ORDER BY start_date DESC LIMIT 20`,
      [req.params.id]
    );

    res.json({ staff: result.rows[0], leave: leave.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/hr/staff ───────────────────────────────────────────────────────
router.post("/staff", authorize("admin","principal"), async (req, res) => {
  try {
    const {
      first_name, last_name, date_of_birth, gender, id_number, nationality,
      email, phone, address,
      job_title, department, employment_type = "Full-Time",
      hire_date, contract_end_date, salary, bank_name, bank_account,
      qualification, emergency_contact, emergency_phone,
      user_id, // optional link to system user account
    } = req.body;

    if (!first_name || !last_name || !job_title) {
      return res.status(400).json({ error: "First name, last name and job title are required." });
    }

    // Auto-generate employee ID
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM staff WHERE campus = $1`, [req.campus]
    );
    const empId = `EMP${String(parseInt(countRes.rows[0].count)+1).padStart(3,"0")}`;

    const result = await pool.query(
      `INSERT INTO staff (
         employee_id, first_name, last_name, date_of_birth, gender, id_number, nationality,
         email, phone, address, job_title, department, employment_type,
         hire_date, contract_end_date, salary, bank_name, bank_account,
         qualification, emergency_contact, emergency_phone,
         employment_status, user_id, campus
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'Active',$22,$23
       ) RETURNING *`,
      [
        empId, first_name, last_name, date_of_birth||null, gender||null, id_number||null, nationality||null,
        email||null, phone||null, address||null, job_title, department||null, employment_type,
        hire_date||null, contract_end_date||null, salary||null, bank_name||null, bank_account||null,
        qualification||null, emergency_contact||null, emergency_phone||null,
        user_id||null, req.campus,
      ]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus) VALUES ($1,'CREATE_STAFF','staff',$2,$3)`,
      [req.user.id, result.rows[0].id, req.campus]
    );

    res.status(201).json({ staff: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/hr/staff/:id ────────────────────────────────────────────────────
router.put("/staff/:id", authorize("admin","principal","accountant"), async (req, res) => {
  try {
    const {
      first_name, last_name, date_of_birth, gender, id_number, nationality,
      email, phone, address, job_title, department, employment_type,
      hire_date, contract_end_date, salary, bank_name, bank_account,
      qualification, emergency_contact, emergency_phone,
      employment_status, user_id,
    } = req.body;

    const result = await pool.query(
      `UPDATE staff SET
         first_name         = COALESCE($1,  first_name),
         last_name          = COALESCE($2,  last_name),
         date_of_birth      = COALESCE($3,  date_of_birth),
         gender             = COALESCE($4,  gender),
         id_number          = COALESCE($5,  id_number),
         nationality        = COALESCE($6,  nationality),
         email              = COALESCE($7,  email),
         phone              = COALESCE($8,  phone),
         address            = COALESCE($9,  address),
         job_title          = COALESCE($10, job_title),
         department         = COALESCE($11, department),
         employment_type    = COALESCE($12, employment_type),
         hire_date          = COALESCE($13, hire_date),
         contract_end_date  = COALESCE($14, contract_end_date),
         salary             = COALESCE($15, salary),
         bank_name          = COALESCE($16, bank_name),
         bank_account       = COALESCE($17, bank_account),
         qualification      = COALESCE($18, qualification),
         emergency_contact  = COALESCE($19, emergency_contact),
         emergency_phone    = COALESCE($20, emergency_phone),
         employment_status  = COALESCE($21, employment_status),
         user_id            = COALESCE($22, user_id),
         updated_at         = NOW()
       WHERE id = $23 AND campus = $24
       RETURNING *`,
      [
        first_name, last_name, date_of_birth||null, gender||null, id_number||null, nationality||null,
        email||null, phone||null, address||null, job_title||null, department||null, employment_type||null,
        hire_date||null, contract_end_date||null, salary||null, bank_name||null, bank_account||null,
        qualification||null, emergency_contact||null, emergency_phone||null,
        employment_status||null, user_id||null,
        req.params.id, req.campus,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Staff member not found." });

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus) VALUES ($1,'UPDATE_STAFF','staff',$2,$3)`,
      [req.user.id, req.params.id, req.campus]
    );

    res.json({ staff: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/hr/leave ───────────────────────────────────────────────────────
router.post("/leave", authorize("admin","principal","accountant","teacher"), async (req, res) => {
  try {
    const { staff_id, leave_type, start_date, end_date, reason } = req.body;
    if (!staff_id || !leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: "Staff ID, leave type and dates are required." });
    }

    // Calculate working days
    const start  = new Date(start_date);
    const end    = new Date(end_date);
    let days = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) days++;
      cur.setDate(cur.getDate()+1);
    }

    const result = await pool.query(
      `INSERT INTO staff_leave (staff_id, leave_type, start_date, end_date, days, reason, status, campus)
       VALUES ($1,$2,$3,$4,$5,$6,'Pending',$7)
       RETURNING *`,
      [staff_id, leave_type, start_date, end_date, days, reason||null, req.campus]
    );

    res.status(201).json({ leave: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/hr/leave/:id ────────────────────────────────────────────────────
router.put("/leave/:id", authorize("admin","principal"), async (req, res) => {
  try {
    const { status, approved_by } = req.body;
    const result = await pool.query(
      `UPDATE staff_leave SET status=$1, approved_by=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status, approved_by||req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Leave record not found." });
    res.json({ leave: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
