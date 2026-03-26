// src/routes/billing.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── GET /api/billing/invoices ────────────────────────────────────────────────
router.get("/invoices", async (req, res) => {
  try {
    const { search, status, form, grade, term, year, limit = 25, page = 1 } = req.query;
    const campus = req.campus;
    const conditions = ["i.campus = $1"];
    const params = [campus];
    let n = 2;

    if (status)        { conditions.push(`i.status = $${n++}`); params.push(status); }
    if (term)          { conditions.push(`i.term = $${n++}`);   params.push(term); }
    if (year)          { conditions.push(`i.year = $${n++}`);   params.push(parseInt(year)); }
    if (form || grade) { conditions.push(`s.form = $${n++}`);   params.push(form || grade); }
    if (search) {
      conditions.push(`(s.first_name ILIKE $${n} OR s.last_name ILIKE $${n} OR i.invoice_no ILIKE $${n})`);
      params.push(`%${search}%`); n++;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where  = `WHERE ${conditions.join(" AND ")}`;

    const [data, count] = await Promise.all([
      pool.query(
        `SELECT i.id, i.invoice_no, i.term, i.year, i.status,
                i.tuition, i.levy, i.boarding, i.bond_paper,
                i.registration, i.uniforms, i.medical_aid, i.fine, i.other,
                i.amount_due, i.amount_paid,
                (i.amount_due - i.amount_paid) AS balance,
                i.due_date, i.notes, i.created_at,
                s.id AS student_db_id,
                s.first_name, s.last_name,
                s.form AS grade, s.form, s.class
         FROM invoices i
         JOIN students s ON s.id = i.student_id
         ${where}
         ORDER BY i.created_at DESC
         LIMIT $${n++} OFFSET $${n++}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM invoices i JOIN students s ON s.id = i.student_id ${where}`, params
      ),
    ]);

    res.json({
      invoices: data.rows,
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

// ─── GET /api/billing/invoices/:id ────────────────────────────────────────────
router.get("/invoices/:id", async (req, res) => {
  try {
    const [invoice, payments, plan] = await Promise.all([
      pool.query(
        `SELECT i.*, (i.amount_due - i.amount_paid) AS balance,
                s.first_name, s.last_name, s.form AS grade, s.form, s.class
         FROM invoices i
         JOIN students s ON s.id = i.student_id
         WHERE i.id = $1`, [req.params.id]
      ),
      pool.query(
        `SELECT p.*, u.full_name AS received_by_name
         FROM payments p
         LEFT JOIN users u ON u.id = p.received_by
         WHERE p.invoice_id = $1 ORDER BY p.payment_date`, [req.params.id]
      ),
      pool.query(
        `SELECT * FROM installment_plans WHERE invoice_id = $1`, [req.params.id]
      ),
    ]);

    if (!invoice.rows.length) return res.status(404).json({ error: "Invoice not found." });

    res.json({
      invoice: invoice.rows[0],
      payments: payments.rows,
      installment_plan: plan.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/billing/invoices ───────────────────────────────────────────────
router.post("/invoices", authorize("admin","accountant"), async (req, res) => {
  try {
    const {
      studentId, term, year, dueDate, notes,
      tuition = 0, levy = 0, boarding = 0, bond_paper = 0,
      registration = 0, uniforms = 0, medical_aid = 0, fine = 0, other = 0,
      // Also support fee_* format from the frontend form
    } = req.body;

    // Support both formats
    const t   = parseFloat(req.body.fee_Tuition       || req.body["fee_Tuition"]       || tuition       || 0);
    const l   = parseFloat(req.body.fee_Levy           || req.body["fee_Levy"]           || levy           || 0);
    const b   = parseFloat(req.body.fee_Boarding       || req.body["fee_Boarding"]       || boarding       || 0);
    const bp  = parseFloat(req.body["fee_Bond Paper"]  || req.body.fee_Bond_Paper        || bond_paper     || 0);
    const reg = parseFloat(req.body.fee_Registration   || req.body["fee_Registration"]   || registration   || 0);
    const uni = parseFloat(req.body.fee_Uniforms       || req.body["fee_Uniforms"]       || uniforms       || 0);
    const med = parseFloat(req.body["fee_Medical Aid"] || req.body.fee_Medical_Aid       || medical_aid    || 0);
    const fin = parseFloat(req.body.fee_Fine           || req.body["fee_Fine"]           || fine           || 0);
    const oth = parseFloat(req.body.fee_Other          || req.body["fee_Other"]          || other          || 0);
    const amountDue = req.body.amountDue ? parseFloat(req.body.amountDue) : (t+l+b+bp+reg+uni+med+fin+oth);

    if (!studentId || !term || !year) {
      return res.status(400).json({ error: "Student, term and year are required." });
    }

    // Generate invoice number (next in sequence)
    const lastInv = await pool.query(
      `SELECT invoice_no FROM invoices ORDER BY id DESC LIMIT 1`
    );
    let nextNo = 34828;
    if (lastInv.rows.length) {
      const last = parseInt(lastInv.rows[0].invoice_no);
      if (!isNaN(last)) nextNo = last + 1;
    }

    const result = await pool.query(
      `INSERT INTO invoices
         (invoice_no, student_id, term, year, campus,
          tuition, levy, boarding, bond_paper, registration, uniforms, medical_aid, fine, other,
          amount_due, amount_paid, status, due_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,0,'Unpaid',$16,$17,$18)
       RETURNING *, (amount_due - amount_paid) AS balance`,
      [String(nextNo), studentId, term, parseInt(year), req.campus,
       t, l, b, bp, reg, uni, med, fin, oth, amountDue,
       dueDate || null, notes || null, req.user.id]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus)
       VALUES ($1,'CREATE_INVOICE','invoices',$2,$3)`,
      [req.user.id, result.rows[0].id, req.campus]
    );

    res.status(201).json({ invoice: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/billing/payments ───────────────────────────────────────────────
router.post("/payments", authorize("admin","accountant"), async (req, res) => {
  try {
    const { invoiceId, amount, method, notes, payment_date } = req.body;
    if (!invoiceId || !amount || !method) {
      return res.status(400).json({ error: "Invoice ID, amount and payment method are required." });
    }

    const validMethods = ["Cash","Bank Transfer","EcoCash","Cheque","Card"];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: `Payment method must be one of: ${validMethods.join(", ")}` });
    }

    // Get invoice
    const invRes = await pool.query(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]);
    if (!invRes.rows.length) return res.status(404).json({ error: "Invoice not found." });
    const inv = invRes.rows[0];

    const payAmt   = parseFloat(amount);
    const balance  = parseFloat(inv.amount_due) - parseFloat(inv.amount_paid);
    if (payAmt > balance + 0.01) {
      return res.status(400).json({ error: `Payment ($${payAmt}) exceeds outstanding balance ($${balance.toFixed(2)}).` });
    }

    // Record payment
    const newPaid  = parseFloat(inv.amount_paid) + payAmt;
    const newStatus = newPaid >= parseFloat(inv.amount_due) - 0.01 ? "Paid" : "Partial";

    const [payment] = await Promise.all([
      pool.query(
        `INSERT INTO payments (invoice_id, amount, payment_method, payment_date, received_by, notes, receipt_no)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [invoiceId, payAmt, method, payment_date || new Date().toISOString().split("T")[0],
         req.user.id, notes || null, inv.invoice_no]
      ),
      pool.query(
        `UPDATE invoices SET amount_paid = $1, status = $2, updated_at = NOW() WHERE id = $3`,
        [newPaid, newStatus, invoiceId]
      ),
    ]);

    await pool.query(
      `INSERT INTO audit_log (user_id,action,table_name,record_id,campus,new_data)
       VALUES ($1,'RECORD_PAYMENT','invoices',$2,$3,$4)`,
      [req.user.id, invoiceId, req.campus, JSON.stringify({ amount: payAmt, method })]
    );

    res.status(201).json({
      payment: payment.rows[0],
      invoice_status: newStatus,
      new_balance: parseFloat(inv.amount_due) - newPaid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/billing/installments ───────────────────────────────────────────
router.post("/installments", authorize("admin","accountant"), async (req, res) => {
  try {
    const { invoiceId, studentId, installments, notes } = req.body;
    if (!invoiceId || !installments) {
      return res.status(400).json({ error: "Invoice ID and installments are required." });
    }
    const result = await pool.query(
      `INSERT INTO installment_plans (invoice_id, student_id, installments, notes, created_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (invoice_id) DO UPDATE SET installments=$3, notes=$4
       RETURNING *`,
      [invoiceId, studentId, JSON.stringify(installments), notes || null, req.user.id]
    );
    res.status(201).json({ plan: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/billing/summary ─────────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const campus = req.campus;
    const { term, year } = req.query;
    const conditions = ["campus = $1"];
    const params = [campus];
    let i = 2;
    if (term) { conditions.push(`term = $${i++}`); params.push(term); }
    if (year) { conditions.push(`year = $${i++}`); params.push(parseInt(year)); }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const result = await pool.query(
      `SELECT
         SUM(amount_due)              AS total_billed,
         SUM(amount_paid)             AS total_collected,
         SUM(amount_due - amount_paid) AS total_outstanding,
         COUNT(*) FILTER (WHERE status = 'Paid')    AS paid_count,
         COUNT(*) FILTER (WHERE status = 'Partial') AS partial_count,
         COUNT(*) FILTER (WHERE status = 'Unpaid')  AS unpaid_count,
         COUNT(*) FILTER (WHERE status = 'Overdue') AS overdue_count,
         COUNT(*) AS total_invoices
       FROM invoices ${where}`, params
    );
    res.json({ summary: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/billing/defaulters ─────────────────────────────────────────────
router.get("/defaulters", authorize("admin","accountant","principal"), async (req, res) => {
  try {
    const campus = req.campus;
    const result = await pool.query(
      `SELECT i.invoice_no, i.term, i.year,
              i.amount_due, i.amount_paid,
              (i.amount_due - i.amount_paid) AS balance,
              i.status, i.due_date,
              s.first_name, s.last_name, s.form, s.form AS grade,
              s.parent_phone, s.parent_email
       FROM invoices i
       JOIN students s ON s.id = i.student_id
       WHERE i.campus = $1 AND i.status IN ('Unpaid','Overdue','Partial')
         AND (i.amount_due - i.amount_paid) > 0
       ORDER BY (i.amount_due - i.amount_paid) DESC`,
      [campus]
    );
    res.json({ defaulters: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
