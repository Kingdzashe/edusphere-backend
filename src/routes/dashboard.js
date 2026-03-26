// src/routes/dashboard.js
const express = require("express");
const pool    = require("../db/pool");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const campus = req.campus;
    const today  = new Date().toISOString().split("T")[0];

    const [
      students, todayAtt, billing, formBreakdown,
      attTrend, avgScore, openDiscipline
    ] = await Promise.all([

      // Student counts
      pool.query(`
        SELECT
          COUNT(*)                                     AS total,
          COUNT(*) FILTER (WHERE status = 'Active')    AS active,
          COUNT(*) FILTER (WHERE status = 'Inactive')  AS inactive,
          COUNT(*) FILTER (WHERE status = 'Graduated') AS graduated
        FROM students WHERE campus = $1`, [campus]),

      // Today's attendance
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE a.status = 'Present') AS present,
          COUNT(*) FILTER (WHERE a.status = 'Absent')  AS absent,
          COUNT(*) AS total,
          ROUND(COUNT(*) FILTER (WHERE a.status='Present')*100.0/NULLIF(COUNT(*),0),1) AS rate
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        WHERE s.campus = $1 AND a.date = $2`, [campus, today]),

      // Billing summary
      pool.query(`
        SELECT
          COALESCE(SUM(amount_due),0)              AS total_billed,
          COALESCE(SUM(amount_paid),0)             AS total_collected,
          COALESCE(SUM(amount_due-amount_paid),0)  AS total_outstanding,
          COUNT(*) FILTER (WHERE status='Overdue') AS overdue_count
        FROM invoices WHERE campus = $1`, [campus]),

      // Students by form
      pool.query(`
        SELECT form AS grade, COUNT(*) AS count
        FROM students WHERE campus = $1 AND status = 'Active'
        GROUP BY form ORDER BY form`, [campus]),

      // Attendance trend — last 7 school days
      pool.query(`
        SELECT a.date,
          COUNT(*) FILTER (WHERE a.status='Present') AS present,
          COUNT(*) FILTER (WHERE a.status='Absent')  AS absent
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        WHERE s.campus = $1 AND a.date >= (CURRENT_DATE - INTERVAL '14 days')
        GROUP BY a.date ORDER BY a.date DESC LIMIT 7`, [campus]),

      // Average mark this term
      pool.query(`
        SELECT ROUND(AVG(r.mark),1) AS avg_score
        FROM results r
        JOIN students s ON s.id = r.student_id
        WHERE s.campus = $1 AND r.report_type = 'term_report'
          AND r.year = EXTRACT(YEAR FROM CURRENT_DATE)`, [campus]),

      // Open discipline cases
      pool.query(`
        SELECT COUNT(*) AS count FROM discipline
        WHERE campus = $1 AND status = 'Open'`, [campus]),
    ]);

    res.json({
      students:        students.rows[0],
      attendance:      todayAtt.rows[0],
      billing:         billing.rows[0],
      gradeBreakdown:  formBreakdown.rows,
      attendanceTrend: attTrend.rows.reverse(),
      avgScore:        parseFloat(avgScore.rows[0]?.avg_score || 0).toFixed(1),
      openDiscipline:  parseInt(openDiscipline.rows[0]?.count || 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
