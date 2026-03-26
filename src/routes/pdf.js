// src/routes/pdf.js
const express = require("express");
const PDFDocument = require("pdfkit");
const pool = require("../db/pool");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ─── School info ──────────────────────────────────────────────────────────────
const SCHOOL = {
  name:    "Still Waters Learning Academy",
  group:   "Still Waters Group of Schools",
  motto:   '"Restoring values, morals and identity through education"',
  address: "P.O Box 76 Ruwa, 6319 Mutunduru, Zimre Park, Ruwa",
  tel:     "+263 772 323 602 / +263 774 971 512",
  email:   "stillwaters2013@gmail.com",
  bank:    "Ecobank",
  account: "576700023470",
  website: "www.stillwatergroupofschools.co.zw",
};

// ─── Colours ──────────────────────────────────────────────────────────────────
const RED  = "#C41E3A";
const TEAL = "#0891B2";
const GREY = "#6B7280";
const DARK = "#1A1A1A";
const LIGHT_GREY = "#F5F5F5";
const BORDER = "#E5E7EB";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setFont(doc, weight, size, color) {
  doc.font(weight === "bold" ? "Helvetica-Bold" : "Helvetica")
     .fontSize(size)
     .fillColor(color || DARK);
}

function drawLine(doc, x1, y1, x2, y2, color, width) {
  doc.strokeColor(color || BORDER).lineWidth(width || 0.5).moveTo(x1,y1).lineTo(x2,y2).stroke();
}

function drawRect(doc, x, y, w, h, fillColor, strokeColor) {
  doc.rect(x, y, w, h);
  if (fillColor)  doc.fill(fillColor);
  if (strokeColor) doc.strokeColor(strokeColor).stroke();
  if (fillColor)  doc.fillColor(DARK); // reset
}

function schoolHeader(doc, logoData) {
  const pageW = doc.page.width;
  const margin = 40;

  // Red top bar
  drawRect(doc, 0, 0, pageW, 8, RED);

  // Logo
  if (logoData) {
    const buf = Buffer.from(logoData.replace(/^data:image\/png;base64,/, ""), "base64");
    doc.image(buf, margin, 14, { width: 60, height: 60 });
  }

  // School name block
  const textX = logoData ? margin + 68 : margin;
  setFont(doc, "bold", 18, RED);
  doc.text(SCHOOL.name, textX, 16, { lineBreak: false });

  setFont(doc, "bold", 9, TEAL);
  doc.text(SCHOOL.group, textX, 36, { lineBreak: false });

  setFont(doc, "normal", 8, GREY);
  doc.text(SCHOOL.motto, textX, 50, { lineBreak: false });

  // Right side contact info
  setFont(doc, "normal", 7.5, GREY);
  doc.text(`Tel: ${SCHOOL.tel}`, pageW - 230, 16, { width: 190, align: "right" });
  doc.text(SCHOOL.email, pageW - 230, 28, { width: 190, align: "right" });
  doc.text(SCHOOL.address, pageW - 230, 40, { width: 190, align: "right" });

  // Divider
  const lineY = 80;
  drawRect(doc, 0, lineY, pageW, 2, RED);

  return lineY + 10;
}

// Effort label
const EFFORT_LABELS = {
  "4": "Excellent", "3": "Good", "2": "Satisfactory",
  "1": "Can Be Improved", "0": "Poor", "-1": "Unacceptable Attitude"
};

// ─── GET /api/pdf/report-card/:studentId ─────────────────────────────────────
router.get("/report-card/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term = "Term 1", year = new Date().getFullYear(), report_type = "term_report" } = req.query;
    const campus = req.campus;

    // ── Fetch all data ────────────────────────────────────────────────────────
    const [studentRes, resultsRes, attendanceRes] = await Promise.all([
      pool.query(`SELECT * FROM students WHERE id = $1 AND campus = $2`, [studentId, campus]),
      pool.query(
        `SELECT r.mark, r.grade, r.remarks, r.effort, r.class_average, r.report_type,
                sub.name AS subject_name, sub.curriculum
         FROM results r
         JOIN subjects sub ON sub.id = r.subject_id
         WHERE r.student_id = $1 AND r.term = $2 AND r.year = $3 AND r.report_type = $4
         ORDER BY sub.name`,
        [studentId, term, parseInt(year), report_type]
      ),
      pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status='Present') AS present,
                COUNT(*) FILTER (WHERE status='Absent')  AS absent,
                ROUND(COUNT(*) FILTER (WHERE status='Present')*100.0/NULLIF(COUNT(*),0),1) AS rate
         FROM attendance WHERE student_id = $1`,
        [studentId]
      ),
    ]);

    if (!studentRes.rows.length) return res.status(404).json({ error: "Student not found." });

    const student    = studentRes.rows[0];
    const results    = resultsRes.rows;
    const attendance = attendanceRes.rows[0];

    // ── Load logo ─────────────────────────────────────────────────────────────
    let logoData = null;
    try { logoData = require("../logo_b64"); } catch {}

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `inline; filename="report-card-${student.last_name}-${student.first_name}-${term}-${year}.pdf"`);
    doc.pipe(res);

    const pageW  = doc.page.width;
    const margin = 40;
    const colW   = pageW - margin * 2;

    // Header
    let y = schoolHeader(doc, logoData);

    // Report title
    const isMarkReader = report_type === "mark_reader";
    setFont(doc, "bold", 14, RED);
    const titleText = isMarkReader
      ? `HALF TERM MARK READER — ${term.toUpperCase()} ${year}`
      : `ACADEMIC REPORT — ${term.toUpperCase()} ${year}`;
    doc.text(titleText, margin, y, { align: "center", width: colW });
    y = doc.y + 12;

    // Student info box
    drawRect(doc, margin, y, colW, 56, LIGHT_GREY);
    drawRect(doc, margin, y, colW, 56, null, BORDER);

    const infoY = y + 8;
    const col1  = margin + 8;
    const col2  = margin + colW / 2;

    setFont(doc, "bold", 8, GREY);
    doc.text("NAME:", col1, infoY);
    doc.text("FORM:", col1, infoY + 16);
    doc.text("STUDENT ID:", col1, infoY + 32);

    setFont(doc, "bold", 10, DARK);
    doc.text(`${student.last_name}, ${student.first_name}`, col1 + 60, infoY);

    setFont(doc, "normal", 9, DARK);
    doc.text(`Form ${student.form} · ${student.class || ""}`, col1 + 60, infoY + 16);
    doc.text(student.student_id, col1 + 60, infoY + 32);

    // Right column
    setFont(doc, "bold", 8, GREY);
    doc.text("TERM:", col2, infoY);
    doc.text("YEAR:", col2, infoY + 16);
    doc.text("DATE ISSUED:", col2, infoY + 32);

    setFont(doc, "normal", 9, DARK);
    doc.text(term, col2 + 70, infoY);
    doc.text(String(year), col2 + 70, infoY + 16);
    doc.text(new Date().toLocaleDateString("en-GB"), col2 + 70, infoY + 32);

    y = y + 70;

    // ── Results table ─────────────────────────────────────────────────────────
    setFont(doc, "bold", 9, WHITE_TEXT(RED));
    drawRect(doc, margin, y, colW, 22, RED);
    doc.text("ACADEMIC RESULTS", margin + 8, y + 6, { width: colW - 16 });
    y += 22;

    // Table header
    const cols = isMarkReader
      ? [
          { label: "SUBJECT",       x: margin + 8,   w: 200 },
          { label: "CURRICULUM",    x: margin + 215,  w: 90  },
          { label: "MARK %",        x: margin + 312,  w: 55  },
          { label: "CLASS AVG",     x: margin + 374,  w: 60  },
          { label: "EFFORT",        x: margin + 440,  w: 75  },
        ]
      : [
          { label: "SUBJECT",       x: margin + 8,   w: 230 },
          { label: "CURRICULUM",    x: margin + 245,  w: 90  },
          { label: "MARK %",        x: margin + 342,  w: 55  },
          { label: "GRADE",         x: margin + 404,  w: 45  },
          { label: "REMARKS",       x: margin + 456,  w: 80  },
        ];

    drawRect(doc, margin, y, colW, 18, "#F0F4F8");
    setFont(doc, "bold", 7.5, GREY);
    cols.forEach(c => doc.text(c.label, c.x, y + 5));
    y += 18;

    // Rows
    const GRADE_COLORS = {
      "A*": TEAL, "A": "#059669", "B": TEAL, "C": "#D97706",
      "D": GREY, "E": RED, "F": RED, "G": RED, "U": RED,
    };

    results.forEach((r, idx) => {
      const rowH = 18;
      const bg   = idx % 2 === 0 ? "white" : LIGHT_GREY;
      drawRect(doc, margin, y, colW, rowH, bg);

      setFont(doc, "normal", 8.5, DARK);
      doc.text(r.subject_name, cols[0].x, y + 5, { width: cols[0].w - 4, ellipsis: true });

      setFont(doc, "normal", 7.5, GREY);
      doc.text((r.curriculum || "").replace("_", " "), cols[1].x, y + 5);

      setFont(doc, "bold", 9, DARK);
      doc.text(r.mark !== null ? `${parseFloat(r.mark).toFixed(0)}%` : "—", cols[2].x, y + 5);

      if (isMarkReader) {
        setFont(doc, "normal", 8, GREY);
        doc.text(r.class_average ? `${parseFloat(r.class_average).toFixed(0)}%` : "—", cols[3].x, y + 5);
        const effortKey = String(r.effort);
        const effortLabel = EFFORT_LABELS[effortKey] || "—";
        const effortColor = r.effort >= 3 ? "#059669" : r.effort >= 1 ? "#D97706" : RED;
        setFont(doc, "bold", 8, effortColor);
        doc.text(`${r.effort !== null ? r.effort : "—"} — ${effortLabel}`, cols[4].x, y + 5);
      } else {
        const gc = GRADE_COLORS[r.grade] || GREY;
        setFont(doc, "bold", 11, gc);
        doc.text(r.grade || "—", cols[3].x, y + 4);
        setFont(doc, "normal", 7.5, GREY);
        doc.text(r.remarks || "—", cols[4].x, y + 5, { width: cols[4].w });
      }
      y += rowH;
    });

    if (results.length === 0) {
      drawRect(doc, margin, y, colW, 30, LIGHT_GREY);
      setFont(doc, "normal", 9, GREY);
      doc.text("No results entered for this term.", margin + 8, y + 10);
      y += 30;
    }

    // Bottom border of table
    drawLine(doc, margin, y, margin + colW, y, BORDER, 1);
    y += 16;

    // ── Summary section ───────────────────────────────────────────────────────
    if (!isMarkReader && results.length > 0) {
      const avg = results.reduce((s, r) => s + (parseFloat(r.mark) || 0), 0) / results.length;
      const overall = avg >= 75 ? "Distinction" : avg >= 65 ? "Merit" : avg >= 50 ? "Credit" : avg >= 40 ? "Satisfactory" : "Needs Improvement";
      const overallColor = avg >= 50 ? "#059669" : avg >= 40 ? "#D97706" : RED;

      drawRect(doc, margin, y, colW, 36, "#FEF2F2");
      drawRect(doc, margin, y, colW, 36, null, BORDER);

      setFont(doc, "bold", 9, GREY);
      doc.text("AVERAGE MARK:", margin + 10, y + 8);
      setFont(doc, "bold", 14, overallColor);
      doc.text(`${avg.toFixed(1)}%`, margin + 110, y + 5);

      setFont(doc, "bold", 9, GREY);
      doc.text("OVERALL:", margin + 180, y + 8);
      setFont(doc, "bold", 11, overallColor);
      doc.text(overall, margin + 240, y + 8);

      // Subjects passed
      const passed = results.filter(r => !["E","F","G","U"].includes(r.grade)).length;
      setFont(doc, "bold", 9, GREY);
      doc.text(`SUBJECTS: ${passed}/${results.length} passed`, margin + 380, y + 8);

      y += 50;
    }

    // ── Attendance ────────────────────────────────────────────────────────────
    drawRect(doc, margin, y, colW, 22, RED);
    setFont(doc, "bold", 9, "white");
    doc.text("ATTENDANCE SUMMARY", margin + 8, y + 6);
    y += 22;

    drawRect(doc, margin, y, colW, 32, LIGHT_GREY);
    drawRect(doc, margin, y, colW, 32, null, BORDER);

    const attCols = [
      { label: "DAYS PRESENT", val: attendance.present || 0, color: "#059669" },
      { label: "DAYS ABSENT",  val: attendance.absent  || 0, color: RED        },
      { label: "TOTAL DAYS",   val: attendance.total   || 0, color: TEAL       },
      { label: "RATE",         val: `${attendance.rate || 0}%`, color: parseFloat(attendance.rate) >= 80 ? "#059669" : RED },
    ];
    const attColW = colW / attCols.length;
    attCols.forEach((a, idx) => {
      const ax = margin + idx * attColW + attColW / 2;
      setFont(doc, "bold", 16, a.color);
      doc.text(String(a.val), ax - 20, y + 4, { width: 40, align: "center" });
      setFont(doc, "bold", 7, GREY);
      doc.text(a.label, ax - 35, y + 22, { width: 70, align: "center" });
    });
    y += 46;

    // ── Teacher comment ───────────────────────────────────────────────────────
    if (!isMarkReader) {
      drawRect(doc, margin, y, colW, 22, RED);
      setFont(doc, "bold", 9, "white");
      doc.text("CLASS TEACHER'S COMMENT", margin + 8, y + 6);
      y += 22;

      drawRect(doc, margin, y, colW, 52, "white");
      drawRect(doc, margin, y, colW, 52, null, BORDER);
      setFont(doc, "normal", 9, GREY);
      doc.text("_".repeat(100), margin + 8, y + 10);
      doc.text("_".repeat(100), margin + 8, y + 28);

      setFont(doc, "bold", 8, GREY);
      doc.text("Signature: ____________________", margin + 8, y + 44);
      y += 66;
    }

    // ── Principal signature ───────────────────────────────────────────────────
    if (!isMarkReader) {
      setFont(doc, "bold", 8, GREY);
      doc.text("PRINCIPAL'S SIGNATURE: ____________________", margin, y);
      doc.text(`DATE: ____________________`, pageW - 240, y);
      y += 20;

      // School stamp box
      doc.rect(pageW - margin - 80, y, 80, 50).stroke(BORDER);
      setFont(doc, "normal", 7, GREY);
      doc.text("SCHOOL STAMP", pageW - margin - 76, y + 20, { width: 72, align: "center" });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 35;
    drawLine(doc, 0, footerY, pageW, footerY, RED, 2);
    setFont(doc, "normal", 7.5, GREY);
    doc.text(
      `${SCHOOL.name} · ${SCHOOL.address} · ${SCHOOL.tel} · ${SCHOOL.email}`,
      margin, footerY + 6,
      { width: colW, align: "center" }
    );

    doc.end();

  } catch (err) {
    console.error("PDF report card error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/pdf/invoice/:invoiceId ─────────────────────────────────────────
router.get("/invoice/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const [invoiceRes, paymentsRes] = await Promise.all([
      pool.query(
        `SELECT i.*, s.first_name, s.last_name, s.form, s.class, s.student_id AS student_no,
                s.parent_name, s.parent_phone
         FROM invoices i
         JOIN students s ON s.id = i.student_id
         WHERE i.id = $1`, [invoiceId]
      ),
      pool.query(
        `SELECT p.*, u.full_name AS received_by_name
         FROM payments p LEFT JOIN users u ON u.id = p.received_by
         WHERE p.invoice_id = $1 ORDER BY p.payment_date`, [invoiceId]
      ),
    ]);

    if (!invoiceRes.rows.length) return res.status(404).json({ error: "Invoice not found." });
    const inv  = invoiceRes.rows[0];
    const pmts = paymentsRes.rows;
    const balance = parseFloat(inv.amount_due) - parseFloat(inv.amount_paid);

    let logoData = null;
    try { logoData = require("../logo_b64"); } catch {}

    const doc = new PDFDocument({ size: [595, 842], margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `inline; filename="invoice-${inv.invoice_no}-${inv.last_name}.pdf"`);
    doc.pipe(res);

    const pageW  = doc.page.width;
    const margin = 40;
    const colW   = pageW - margin * 2;

    // Header
    let y = schoolHeader(doc, logoData);

    // Title
    setFont(doc, "bold", 16, RED);
    doc.text("FEES INVOICE", margin, y, { align: "center", width: colW });
    y = doc.y + 6;

    // Invoice number (big, like on their receipts)
    setFont(doc, "bold", 28, TEAL);
    doc.text(inv.invoice_no, pageW - margin - 100, y - 26, { width: 100, align: "right" });

    drawLine(doc, margin, y, margin + colW, y, BORDER, 1);
    y += 12;

    // Student & invoice info
    const infoFields = [
      ["Name of Student:",   `${inv.last_name}, ${inv.first_name}`],
      ["Form / Class:",      `Form ${inv.form} · ${inv.class || ""}`],
      ["Student ID:",        inv.student_no],
      ["Term:",              `${inv.term} ${inv.year}`],
      ["Due Date:",          inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-GB") : "—"],
      ["Status:",            inv.status],
    ];

    const halfW = colW / 2 - 10;
    infoFields.forEach((f, idx) => {
      const isLeft  = idx % 2 === 0;
      const fx = isLeft ? margin : margin + halfW + 20;
      const fy = y + Math.floor(idx / 2) * 18;
      setFont(doc, "bold", 8.5, GREY);
      doc.text(f[0], fx, fy, { width: 100 });
      setFont(doc, "bold", 9, DARK);
      const statusColors = { Paid:"#059669", Partial:"#D97706", Unpaid:RED, Overdue:RED };
      if (f[0] === "Status:") doc.fillColor(statusColors[f[1]] || DARK);
      doc.text(f[1], fx + 108, fy, { width: halfW - 110 });
      doc.fillColor(DARK);
    });
    y += Math.ceil(infoFields.length / 2) * 18 + 10;

    drawLine(doc, margin, y, margin + colW, y, BORDER, 1);
    y += 12;

    // ── Fee lines table ───────────────────────────────────────────────────────
    drawRect(doc, margin, y, colW, 22, RED);
    setFont(doc, "bold", 9, "white");
    doc.text("DESCRIPTION", margin + 10, y + 6, { width: colW * 0.7 });
    doc.text("AMOUNT (USD)", margin + colW * 0.7, y + 6, { width: colW * 0.3 - 8, align: "right" });
    y += 22;

    const feeLines = [
      { label: "Tuition",       val: inv.tuition      },
      { label: "Levy",          val: inv.levy         },
      { label: "Boarding",      val: inv.boarding     },
      { label: "Bond Paper",    val: inv.bond_paper   },
      { label: "Registration",  val: inv.registration },
      { label: "Uniforms",      val: inv.uniforms     },
      { label: "Medical Aid",   val: inv.medical_aid  },
      { label: "Fine",          val: inv.fine         },
      { label: "Other",         val: inv.other        },
    ].filter(f => parseFloat(f.val) > 0);

    feeLines.forEach((f, idx) => {
      const rowH = 20;
      drawRect(doc, margin, y, colW, rowH, idx % 2 === 0 ? "white" : LIGHT_GREY);
      setFont(doc, "normal", 9.5, DARK);
      doc.text(f.label, margin + 10, y + 5);
      setFont(doc, "bold", 9.5, DARK);
      doc.text(`$${parseFloat(f.val).toFixed(2)}`, margin + 10, y + 5, { width: colW - 18, align: "right" });
      y += rowH;
    });

    // Total row
    drawRect(doc, margin, y, colW, 24, "#1A0508");
    setFont(doc, "bold", 11, "white");
    doc.text("TOTAL AMOUNT DUE", margin + 10, y + 6);
    doc.text(`$${parseFloat(inv.amount_due).toFixed(2)}`, margin + 10, y + 6, { width: colW - 18, align: "right" });
    y += 32;

    // ── Payment summary ───────────────────────────────────────────────────────
    const summaryRows = [
      { label: "Amount Paid:",    val: `$${parseFloat(inv.amount_paid).toFixed(2)}`, color: "#059669"  },
      { label: "Outstanding Balance:", val: `$${balance.toFixed(2)}`,               color: balance > 0 ? RED : "#059669" },
    ];
    summaryRows.forEach(s => {
      drawRect(doc, margin, y, colW, 22, LIGHT_GREY);
      drawRect(doc, margin, y, colW, 22, null, BORDER);
      setFont(doc, "bold", 9, GREY);
      doc.text(s.label, margin + 10, y + 6);
      setFont(doc, "bold", 11, s.color);
      doc.text(s.val, margin + 10, y + 5, { width: colW - 18, align: "right" });
      y += 22;
    });
    y += 14;

    // ── Payment history ───────────────────────────────────────────────────────
    if (pmts.length > 0) {
      setFont(doc, "bold", 9, GREY);
      doc.text("PAYMENT HISTORY", margin, y);
      drawLine(doc, margin, y + 12, margin + colW, y + 12, BORDER, 0.5);
      y += 18;

      const pmtCols = [
        { label: "Date",       x: margin,            w: 80  },
        { label: "Method",     x: margin + 85,       w: 100 },
        { label: "Amount",     x: margin + 190,      w: 80  },
        { label: "Received By",x: margin + 275,      w: 130 },
      ];

      drawRect(doc, margin, y, colW, 16, "#F0F4F8");
      setFont(doc, "bold", 7.5, GREY);
      pmtCols.forEach(c => doc.text(c.label, c.x, y + 4));
      y += 16;

      pmts.forEach((p, idx) => {
        drawRect(doc, margin, y, colW, 16, idx % 2 === 0 ? "white" : LIGHT_GREY);
        setFont(doc, "normal", 8.5, DARK);
        doc.text(new Date(p.payment_date).toLocaleDateString("en-GB"), pmtCols[0].x, y + 4);
        doc.text(p.payment_method, pmtCols[1].x, y + 4);
        setFont(doc, "bold", 8.5, "#059669");
        doc.text(`$${parseFloat(p.amount).toFixed(2)}`, pmtCols[2].x, y + 4);
        setFont(doc, "normal", 8.5, DARK);
        doc.text(p.received_by_name || "—", pmtCols[3].x, y + 4);
        y += 16;
      });
      y += 10;
    }

    // ── Bank details ──────────────────────────────────────────────────────────
    drawRect(doc, margin, y, colW, 54, LIGHT_GREY);
    drawRect(doc, margin, y, colW, 54, null, TEAL);

    setFont(doc, "bold", 9, TEAL);
    doc.text("BANKING DETAILS", margin + 10, y + 8);
    setFont(doc, "normal", 9, DARK);
    doc.text(`Bank: ${SCHOOL.bank}`, margin + 10, y + 22);
    doc.text(`Account Name: ${SCHOOL.name}`, margin + 10, y + 34);
    doc.text(`Account Number: ${SCHOOL.account}`, margin + 220, y + 22);

    // Payment methods
    setFont(doc, "bold", 8, GREY);
    doc.text("PAYMENT METHODS:", margin + 10, y + 46);
    setFont(doc, "normal", 8, DARK);
    doc.text("Cash  |  Bank Transfer  |  EcoCash", margin + 115, y + 46);
    y += 68;

    // Note
    setFont(doc, "normal", 8, GREY);
    doc.text(
      "Note: Please bring proof of payment to the school office before or on the first day of term.",
      margin, y, { width: colW }
    );

    // ── Received by ───────────────────────────────────────────────────────────
    const sigY = y + 30;
    setFont(doc, "bold", 8.5, GREY);
    doc.text("Received by: ____________________________", margin, sigY);
    doc.text("Date: _____________________", pageW - margin - 180, sigY);

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 35;
    drawLine(doc, 0, footerY, pageW, footerY, RED, 2);
    setFont(doc, "normal", 7.5, GREY);
    doc.text(
      `${SCHOOL.name} · ${SCHOOL.address} · ${SCHOOL.tel} · ${SCHOOL.email}`,
      margin, footerY + 6,
      { width: colW, align: "center" }
    );

    doc.end();
  } catch (err) {
    console.error("PDF invoice error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// Helper — white text on coloured bg
function WHITE_TEXT() { return "white"; }

module.exports = router;
