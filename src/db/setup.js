require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const pool = require("./pool");

const schema = `

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Drop existing tables (clean slate) ──────────────────────────────────────
DROP TABLE IF EXISTS audit_log          CASCADE;
DROP TABLE IF EXISTS parent_student     CASCADE;
DROP TABLE IF EXISTS teacher_classes    CASCADE;
DROP TABLE IF EXISTS teacher_subjects   CASCADE;
DROP TABLE IF EXISTS timetable          CASCADE;
DROP TABLE IF EXISTS staff_leave        CASCADE;
DROP TABLE IF EXISTS staff              CASCADE;
DROP TABLE IF EXISTS installment_plans  CASCADE;
DROP TABLE IF EXISTS payments           CASCADE;
DROP TABLE IF EXISTS invoices           CASCADE;
DROP TABLE IF EXISTS discipline         CASCADE;
DROP TABLE IF EXISTS attendance         CASCADE;
DROP TABLE IF EXISTS results            CASCADE;
DROP TABLE IF EXISTS subjects           CASCADE;
DROP TABLE IF EXISTS assets             CASCADE;
DROP TABLE IF EXISTS notices            CASCADE;
DROP TABLE IF EXISTS students           CASCADE;
DROP TABLE IF EXISTS users              CASCADE;

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name    VARCHAR(100) NOT NULL,
  email        VARCHAR(100),
  role         VARCHAR(20)  NOT NULL CHECK (role IN ('admin','principal','teacher','accountant','parent')),
  campus       VARCHAR(10)  NOT NULL DEFAULT 'swla' CHECK (campus IN ('swla','swchs')),
  is_approved  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP    DEFAULT NOW(),
  updated_at   TIMESTAMP    DEFAULT NOW()
);

-- ─── Students ─────────────────────────────────────────────────────────────────
CREATE TABLE students (
  id                SERIAL PRIMARY KEY,
  student_id        VARCHAR(10) UNIQUE NOT NULL,
  first_name        VARCHAR(60) NOT NULL,
  last_name         VARCHAR(60) NOT NULL,
  date_of_birth     DATE,
  gender            VARCHAR(10),
  form              VARCHAR(10) NOT NULL CHECK (form IN ('1','2','3C','3Z','4C','4Z','5','6')),
  class             VARCHAR(20),
  campus            VARCHAR(10) NOT NULL DEFAULT 'swla' CHECK (campus IN ('swla','swchs')),
  status            VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Graduated')),
  email             VARCHAR(100),
  phone             VARCHAR(25),
  address           TEXT,
  transport         VARCHAR(30),
  previous_school   VARCHAR(120),
  -- Parent / Guardian
  parent_name       VARCHAR(100),
  parent_phone      VARCHAR(25),
  parent_email      VARCHAR(100),
  father_name       VARCHAR(100),
  father_phone      VARCHAR(25),
  father_email      VARCHAR(100),
  father_occupation VARCHAR(100),
  mother_name       VARCHAR(100),
  mother_phone      VARCHAR(25),
  mother_email      VARCHAR(100),
  -- Emergency
  emergency_contact VARCHAR(100),
  emergency_phone   VARCHAR(25),
  -- Other
  photo_url         VARCHAR(255),
  enroll_date       DATE DEFAULT CURRENT_DATE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- ─── Subjects ─────────────────────────────────────────────────────────────────
-- curriculum: ZIMSEC_O | ZIMSEC_A | CAMBRIDGE_O | CAMBRIDGE_A
CREATE TABLE subjects (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  code       VARCHAR(20),
  curriculum VARCHAR(20) NOT NULL CHECK (curriculum IN ('ZIMSEC_O','ZIMSEC_A','CAMBRIDGE_O','CAMBRIDGE_A')),
  is_active  BOOLEAN DEFAULT TRUE
);

-- ─── Results ──────────────────────────────────────────────────────────────────
-- report_type: term_report (end of term) | mark_reader (half term)
CREATE TABLE results (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id),
  term        VARCHAR(20) NOT NULL,
  year        INTEGER NOT NULL,
  report_type VARCHAR(20) NOT NULL DEFAULT 'term_report'
                CHECK (report_type IN ('term_report','mark_reader')),
  mark        NUMERIC(5,2),       -- percentage 0-100
  effort      SMALLINT CHECK (effort BETWEEN -1 AND 4),  -- mark reader only
  class_average NUMERIC(5,2),     -- mark reader only
  grade       VARCHAR(5),         -- auto-calculated
  remarks     TEXT,
  entered_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (student_id, subject_id, term, year, report_type)
);

-- ─── Attendance ───────────────────────────────────────────────────────────────
CREATE TABLE attendance (
  id         SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     VARCHAR(10) NOT NULL CHECK (status IN ('Present','Absent')),
  remarks    TEXT,
  marked_by  INTEGER REFERENCES users(id),
  campus     VARCHAR(10) DEFAULT 'swla',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (student_id, date)
);

-- ─── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id           SERIAL PRIMARY KEY,
  invoice_no   VARCHAR(20) UNIQUE NOT NULL,
  student_id   INTEGER NOT NULL REFERENCES students(id),
  term         VARCHAR(20) NOT NULL,
  year         INTEGER NOT NULL,
  campus       VARCHAR(10) DEFAULT 'swla',
  -- Fee lines (matching Still Waters receipt)
  tuition      NUMERIC(10,2) DEFAULT 0,
  levy         NUMERIC(10,2) DEFAULT 0,
  boarding     NUMERIC(10,2) DEFAULT 0,
  bond_paper   NUMERIC(10,2) DEFAULT 0,
  registration NUMERIC(10,2) DEFAULT 0,
  uniforms     NUMERIC(10,2) DEFAULT 0,
  medical_aid  NUMERIC(10,2) DEFAULT 0,
  fine         NUMERIC(10,2) DEFAULT 0,
  other        NUMERIC(10,2) DEFAULT 0,
  amount_due   NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid  NUMERIC(10,2) NOT NULL DEFAULT 0,
  status       VARCHAR(20) NOT NULL DEFAULT 'Unpaid'
                CHECK (status IN ('Paid','Partial','Unpaid','Overdue')),
  due_date     DATE,
  notes        TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id             SERIAL PRIMARY KEY,
  invoice_id     INTEGER NOT NULL REFERENCES invoices(id),
  amount         NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('Cash','Bank Transfer','EcoCash','Cheque','Card')),
  payment_date   DATE DEFAULT CURRENT_DATE,
  received_by    INTEGER REFERENCES users(id),
  notes          TEXT,
  receipt_no     VARCHAR(20),
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ─── Installment Plans ────────────────────────────────────────────────────────
CREATE TABLE installment_plans (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id),
  student_id  INTEGER NOT NULL REFERENCES students(id),
  installments JSONB NOT NULL DEFAULT '[]',
  notes       TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Discipline ───────────────────────────────────────────────────────────────
CREATE TABLE discipline (
  id          SERIAL PRIMARY KEY,
  incident_id VARCHAR(20) UNIQUE NOT NULL,
  student_id  INTEGER REFERENCES students(id),
  incident_type VARCHAR(100),
  description TEXT,
  severity    VARCHAR(20) DEFAULT 'Low' CHECK (severity IN ('Low','Medium','High')),
  action_taken TEXT,
  fine_amount NUMERIC(10,2) DEFAULT 0,
  status      VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open','Resolved','Escalated')),
  date        DATE DEFAULT CURRENT_DATE,
  reported_by INTEGER REFERENCES users(id),
  campus      VARCHAR(10) DEFAULT 'swla',
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Notice Board ─────────────────────────────────────────────────────────────
CREATE TABLE notices (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  content      TEXT NOT NULL,
  campus       VARCHAR(10) DEFAULT 'swla',
  target_roles VARCHAR(100) DEFAULT 'all',
  created_by   INTEGER REFERENCES users(id),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT NOW(),
  expires_at   TIMESTAMP
);

-- ─── Asset Register ───────────────────────────────────────────────────────────
CREATE TABLE assets (
  id         SERIAL PRIMARY KEY,
  asset_id   VARCHAR(20) UNIQUE NOT NULL,
  name       VARCHAR(200) NOT NULL,
  category   VARCHAR(60),
  condition  VARCHAR(20) DEFAULT 'Good' CHECK (condition IN ('Good','Fair','Poor')),
  location   VARCHAR(100),
  value      NUMERIC(10,2),
  campus     VARCHAR(10) DEFAULT 'swla',
  notes      TEXT,
  date_added DATE DEFAULT CURRENT_DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Parent–Student links ─────────────────────────────────────────────────────
CREATE TABLE parent_student (
  id              SERIAL PRIMARY KEY,
  parent_user_id  INTEGER NOT NULL REFERENCES users(id),
  student_id      INTEGER NOT NULL REFERENCES students(id),
  relationship    VARCHAR(30),
  UNIQUE (parent_user_id, student_id)
);

-- ─── Teacher–Class assignments ────────────────────────────────────────────────
CREATE TABLE teacher_classes (
  id              SERIAL PRIMARY KEY,
  teacher_user_id INTEGER NOT NULL REFERENCES users(id),
  form            VARCHAR(10) NOT NULL CHECK (form IN ('1','2','3C','3Z','4C','4Z','5','6')),
  subject_id      INTEGER REFERENCES subjects(id),
  campus          VARCHAR(10) DEFAULT 'swla',
  academic_year   INTEGER DEFAULT 2026,
  UNIQUE (teacher_user_id, form, subject_id, academic_year)
);

-- ─── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  table_name  VARCHAR(50),
  record_id   INTEGER,
  old_data    JSONB,
  new_data    JSONB,
  campus      VARCHAR(10),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Teacher Subject Assignments ────────────────────────────────────────────
-- ─── Staff / HR ─────────────────────────────────────────────────────────────
CREATE TABLE staff (
  id                  SERIAL PRIMARY KEY,
  employee_id         VARCHAR(20) UNIQUE NOT NULL,
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  date_of_birth       DATE,
  gender              VARCHAR(10),
  id_number           VARCHAR(30),
  nationality         VARCHAR(50) DEFAULT 'Zimbabwean',
  email               VARCHAR(150),
  phone               VARCHAR(30),
  address             TEXT,
  job_title           VARCHAR(100) NOT NULL,
  department          VARCHAR(100),
  employment_type     VARCHAR(30) DEFAULT 'Full-Time',
  employment_status   VARCHAR(20) DEFAULT 'Active',
  hire_date           DATE,
  contract_end_date   DATE,
  salary              NUMERIC(12,2),
  bank_name           VARCHAR(100),
  bank_account        VARCHAR(50),
  qualification       TEXT,
  emergency_contact   VARCHAR(100),
  emergency_phone     VARCHAR(30),
  user_id             INTEGER REFERENCES users(id),
  campus              VARCHAR(10) DEFAULT 'swla',
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE staff_leave (
  id          SERIAL PRIMARY KEY,
  staff_id    INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type  VARCHAR(50) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  days        INTEGER NOT NULL DEFAULT 1,
  reason      TEXT,
  status      VARCHAR(20) DEFAULT 'Pending',
  approved_by INTEGER REFERENCES users(id),
  campus      VARCHAR(10) DEFAULT 'swla',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_staff_campus ON staff(campus);
CREATE INDEX idx_staff_leave_staff ON staff_leave(staff_id);

-- Explicitly assigns a teacher to a subject+form combination, independent of timetable.
-- This is the primary source of truth for which students a teacher can see.
CREATE TABLE teacher_subjects (
  id               SERIAL PRIMARY KEY,
  teacher_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id       INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  form             VARCHAR(10) NOT NULL CHECK (form IN ('1','2','3C','3Z','4C','4Z','5','6')),
  campus           VARCHAR(10) DEFAULT 'swla',
  academic_year    INTEGER DEFAULT 2026,
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE (teacher_user_id, subject_id, form, campus, academic_year)
);
CREATE INDEX idx_teacher_subjects_teacher ON teacher_subjects(teacher_user_id);

-- ─── Timetable ───────────────────────────────────────────────────────────────
CREATE TABLE timetable (
  id               SERIAL PRIMARY KEY,
  form             VARCHAR(10) NOT NULL CHECK (form IN ('1','2','3C','3Z','4C','4Z','5','6')),
  class            VARCHAR(20),
  day              VARCHAR(12) NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  period           SMALLINT NOT NULL CHECK (period BETWEEN 1 AND 8),
  subject_id       INTEGER REFERENCES subjects(id),
  teacher_user_id  INTEGER REFERENCES users(id),
  room             VARCHAR(50),
  time_start       VARCHAR(8),
  time_end         VARCHAR(8),
  campus           VARCHAR(10) DEFAULT 'swla',
  academic_year    INTEGER DEFAULT 2026,
  UNIQUE (form, day, period, campus, academic_year)
);
CREATE INDEX idx_timetable_form   ON timetable(form);
CREATE INDEX idx_timetable_teacher ON timetable(teacher_user_id);


CREATE INDEX idx_students_form     ON students(form);
CREATE INDEX idx_students_campus   ON students(campus);
CREATE INDEX idx_students_status   ON students(status);
CREATE INDEX idx_results_student   ON results(student_id);
CREATE INDEX idx_results_term_year ON results(term, year);
CREATE INDEX idx_attendance_date   ON attendance(date);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_invoices_student  ON invoices(student_id);
CREATE INDEX idx_invoices_status   ON invoices(status);
CREATE INDEX idx_audit_user        ON audit_log(user_id);
CREATE INDEX idx_audit_created     ON audit_log(created_at);
`;

async function setup() {
  const client = await pool.connect();
  try {
    console.log("🏗️  Setting up Still Waters SIS database...");
    await client.query(schema);
    console.log("✅ Schema created successfully!");
    console.log("\nNext step: run  npm run db:seed  to populate with data.");
  } catch (err) {
    console.error("❌ Setup failed:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
