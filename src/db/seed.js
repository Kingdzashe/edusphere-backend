require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const pool    = require("./pool");
const bcrypt  = require("bcryptjs");

// ─── Grading Functions ────────────────────────────────────────────────────────
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
  const zimsecO  = { A:"Distinction",B:"Merit",C:"Credit",D:"Satisfactory",E:"Fail",U:"Unclassified" };
  const zimsecA  = { A:"Excellent",B:"Very Good",C:"Good",D:"Satisfactory",E:"Pass",F:"Fail" };
  const cambridge = { "A*":"Outstanding","A":"Excellent","B":"Very Good","C":"Good","D":"Satisfactory","E":"Pass","F":"Below Pass","G":"Poor","U":"Ungraded" };
  if (curriculum === "ZIMSEC_O")   return zimsecO[grade]  || "";
  if (curriculum === "ZIMSEC_A")   return zimsecA[grade]  || "";
  return cambridge[grade] || "";
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
const SUBJECTS = [
  // ZIMSEC O-Level (Forms 1, 2, 3Z, 4Z)
  { name:"Mathematics",                         code:"ZMSCO-001", curriculum:"ZIMSEC_O" },
  { name:"English Language",                    code:"ZMSCO-002", curriculum:"ZIMSEC_O" },
  { name:"Shona",                               code:"ZMSCO-003", curriculum:"ZIMSEC_O" },
  { name:"Combined Science",                    code:"ZMSCO-004", curriculum:"ZIMSEC_O" },
  { name:"Geography",                           code:"ZMSCO-005", curriculum:"ZIMSEC_O" },
  { name:"History",                             code:"ZMSCO-006", curriculum:"ZIMSEC_O" },
  { name:"Family & Religious Studies",          code:"ZMSCO-007", curriculum:"ZIMSEC_O" },
  { name:"Principles of Accounts",              code:"ZMSCO-008", curriculum:"ZIMSEC_O" },
  { name:"Business Enterprise & Skills",        code:"ZMSCO-009", curriculum:"ZIMSEC_O" },
  { name:"Biology",                             code:"ZMSCO-010", curriculum:"ZIMSEC_O" },
  { name:"Chemistry",                           code:"ZMSCO-011", curriculum:"ZIMSEC_O" },
  { name:"Literature in English",               code:"ZMSCO-012", curriculum:"ZIMSEC_O" },
  { name:"Economics",                           code:"ZMSCO-013", curriculum:"ZIMSEC_O" },
  { name:"Communication Skills",                code:"ZMSCO-014", curriculum:"ZIMSEC_O" },
  { name:"Information & Communication Technology", code:"ZMSCO-015", curriculum:"ZIMSEC_O" },
  // ZIMSEC A-Level (Forms 5, 6)
  { name:"Mathematics (A-Level)",               code:"ZMSCA-001", curriculum:"ZIMSEC_A" },
  { name:"English Language (A-Level)",          code:"ZMSCA-002", curriculum:"ZIMSEC_A" },
  { name:"Biology (A-Level)",                   code:"ZMSCA-003", curriculum:"ZIMSEC_A" },
  { name:"Chemistry (A-Level)",                 code:"ZMSCA-004", curriculum:"ZIMSEC_A" },
  { name:"Physics (A-Level)",                   code:"ZMSCA-005", curriculum:"ZIMSEC_A" },
  { name:"History (A-Level)",                   code:"ZMSCA-006", curriculum:"ZIMSEC_A" },
  { name:"Economics (A-Level)",                 code:"ZMSCA-007", curriculum:"ZIMSEC_A" },
  { name:"Accounting (A-Level)",                code:"ZMSCA-008", curriculum:"ZIMSEC_A" },
  { name:"Geography (A-Level)",                 code:"ZMSCA-009", curriculum:"ZIMSEC_A" },
  { name:"Family & Religious Studies (A-Level)",code:"ZMSCA-010", curriculum:"ZIMSEC_A" },
  { name:"Literature in English (A-Level)",     code:"ZMSCA-011", curriculum:"ZIMSEC_A" },
  // Cambridge O-Level (Forms 3C, 4C)
  { name:"Mathematics",                         code:"CAMBO-001", curriculum:"CAMBRIDGE_O" },
  { name:"English Language",                    code:"CAMBO-002", curriculum:"CAMBRIDGE_O" },
  { name:"Combined Science",                    code:"CAMBO-003", curriculum:"CAMBRIDGE_O" },
  { name:"Geography",                           code:"CAMBO-004", curriculum:"CAMBRIDGE_O" },
  { name:"History",                             code:"CAMBO-005", curriculum:"CAMBRIDGE_O" },
  { name:"Religious Studies",                   code:"CAMBO-006", curriculum:"CAMBRIDGE_O" },
  { name:"Principles of Accounts",              code:"CAMBO-007", curriculum:"CAMBRIDGE_O" },
  { name:"Business Studies",                    code:"CAMBO-008", curriculum:"CAMBRIDGE_O" },
  { name:"Biology",                             code:"CAMBO-009", curriculum:"CAMBRIDGE_O" },
  { name:"Chemistry",                           code:"CAMBO-010", curriculum:"CAMBRIDGE_O" },
  { name:"Literature in English",               code:"CAMBO-011", curriculum:"CAMBRIDGE_O" },
  { name:"Economics",                           code:"CAMBO-012", curriculum:"CAMBRIDGE_O" },
  { name:"Biblical Studies",                    code:"CAMBO-013", curriculum:"CAMBRIDGE_O" },
  // Cambridge A-Level
  { name:"Mathematics (Cambridge A-Level)",     code:"CAMBA-001", curriculum:"CAMBRIDGE_A" },
  { name:"Biology (Cambridge A-Level)",         code:"CAMBA-002", curriculum:"CAMBRIDGE_A" },
  { name:"Chemistry (Cambridge A-Level)",       code:"CAMBA-003", curriculum:"CAMBRIDGE_A" },
  { name:"Economics (Cambridge A-Level)",       code:"CAMBA-004", curriculum:"CAMBRIDGE_A" },
  { name:"Business Studies (Cambridge A-Level)",code:"CAMBA-005", curriculum:"CAMBRIDGE_A" },
];

// Curriculum for each form
function getCurriculum(form) {
  if (["3C","4C"].includes(form)) return "CAMBRIDGE_O";
  if (["5","6"].includes(form))   return "ZIMSEC_A";  // default A-level to ZIMSEC
  return "ZIMSEC_O";
}

// Sample students (realistic Zimbabwean names)
const STUDENTS = [
  // Form 1
  { first:"Tatenda",   last:"Moyo",       dob:"2013-03-12", gender:"Male",   form:"1",  class:"1A",  phone:"+263771000001", parent:"Blessing Moyo",    pp:"+263771000002" },
  { first:"Rutendo",   last:"Chikwanda",  dob:"2013-07-22", gender:"Female", form:"1",  class:"1A",  phone:"+263771000003", parent:"Farai Chikwanda",   pp:"+263771000004" },
  { first:"Tawanda",   last:"Dube",       dob:"2012-11-05", gender:"Male",   form:"1",  class:"1A",  phone:"+263771000005", parent:"Sithembile Dube",   pp:"+263771000006" },
  { first:"Chiedza",   last:"Maposa",     dob:"2013-01-30", gender:"Female", form:"1",  class:"1A",  phone:"+263771000007", parent:"Edmore Maposa",     pp:"+263771000008" },
  // Form 2
  { first:"Simbarashe",last:"Mutasa",     dob:"2012-04-18", gender:"Male",   form:"2",  class:"2A",  phone:"+263771000009", parent:"Grace Mutasa",      pp:"+263771000010" },
  { first:"Takudzwa",  last:"Chirwa",     dob:"2012-09-25", gender:"Female", form:"2",  class:"2A",  phone:"+263771000011", parent:"Petros Chirwa",     pp:"+263771000012" },
  { first:"Munashe",   last:"Banda",      dob:"2011-06-14", gender:"Male",   form:"2",  class:"2A",  phone:"+263771000013", parent:"Loveness Banda",    pp:"+263771000014" },
  { first:"Ruvimbo",   last:"Nyamande",   dob:"2012-02-08", gender:"Female", form:"2",  class:"2A",  phone:"+263771000015", parent:"Amos Nyamande",     pp:"+263771000016" },
  // Form 3 Cambridge
  { first:"Tinotenda", last:"Mhuru",      dob:"2011-08-20", gender:"Male",   form:"3C", class:"3C",  phone:"+263771000017", parent:"Clara Mhuru",       pp:"+263771000018" },
  { first:"Makanaka",  last:"Sithole",    dob:"2010-12-03", gender:"Female", form:"3C", class:"3C",  phone:"+263771000019", parent:"Darirai Sithole",   pp:"+263771000020" },
  { first:"Farai",     last:"Gumbo",      dob:"2011-05-17", gender:"Male",   form:"3C", class:"3C",  phone:"+263771000021", parent:"Violet Gumbo",      pp:"+263771000022" },
  // Form 3 ZIMSEC
  { first:"Nyasha",    last:"Makwanya",   dob:"2011-03-29", gender:"Female", form:"3Z", class:"3Z",  phone:"+263771000023", parent:"Isaac Makwanya",    pp:"+263771000024" },
  { first:"Kudakwashe",last:"Tembo",      dob:"2010-10-11", gender:"Male",   form:"3Z", class:"3Z",  phone:"+263771000025", parent:"Ruth Tembo",        pp:"+263771000026" },
  { first:"Tarisai",   last:"Madzimure",  dob:"2011-07-06", gender:"Female", form:"3Z", class:"3Z",  phone:"+263771000027", parent:"Arnold Madzimure",  pp:"+263771000028" },
  // Form 4 Cambridge
  { first:"Ngoni",     last:"Choto",      dob:"2010-01-15", gender:"Male",   form:"4C", class:"4C",  phone:"+263771000029", parent:"Josephine Choto",   pp:"+263771000030" },
  { first:"Ropafadzo", last:"Dengura",    dob:"2010-06-22", gender:"Female", form:"4C", class:"4C",  phone:"+263771000031", parent:"Tafadzwa Dengura",  pp:"+263771000032" },
  { first:"Tinashe",   last:"Mutsvangwa", dob:"2009-11-18", gender:"Male",   form:"4C", class:"4C",  phone:"+263771000033", parent:"Miriam Mutsvangwa", pp:"+263771000034" },
  // Form 4 ZIMSEC
  { first:"Munotida",  last:"Nemangandu", dob:"2010-04-05", gender:"Female", form:"4Z", class:"4Z",  phone:"+263771000035", parent:"Gamuchirai Nemangandu",pp:"+263771000036" },
  { first:"Tapiwa",    last:"Chidakwa",   dob:"2009-09-27", gender:"Male",   form:"4Z", class:"4Z",  phone:"+263771000037", parent:"Sheila Chidakwa",   pp:"+263771000038" },
  { first:"Vimbai",    last:"Muza",       dob:"2010-02-13", gender:"Female", form:"4Z", class:"4Z",  phone:"+263771000039", parent:"Peter Muza",        pp:"+263771000040" },
  // Form 5
  { first:"Chiedza",   last:"Bungu",      dob:"2008-08-09", gender:"Female", form:"5",  class:"5A",  phone:"+263771000041", parent:"Florence Bungu",    pp:"+263771000042" },
  { first:"Kupakwashe",last:"Matongo",    dob:"2008-03-31", gender:"Male",   form:"5",  class:"5A",  phone:"+263771000043", parent:"Alice Matongo",     pp:"+263771000044" },
  { first:"Chantaille",last:"Mukonda",    dob:"2009-01-07", gender:"Female", form:"5",  class:"5A",  phone:"+263771000045", parent:"Kuda Mukonda",      pp:"+263771000046" },
  { first:"Nicole",    last:"Matepo",     dob:"2008-11-24", gender:"Female", form:"5",  class:"5A",  phone:"+263771000047", parent:"Simba Matepo",      pp:"+263771000048" },
  { first:"Samuel",    last:"Sibanda",    dob:"2008-06-16", gender:"Male",   form:"5",  class:"5A",  phone:"+263771000049", parent:"Yvonne Sibanda",    pp:"+263771000050" },
  { first:"Jacob",     last:"Charima",    dob:"2009-04-02", gender:"Male",   form:"5",  class:"5A",  phone:"+263771000051", parent:"Emily Charima",     pp:"+263771000052" },
  { first:"Tadiwanashe",last:"Matongo",   dob:"2008-09-19", gender:"Male",   form:"5",  class:"5A",  phone:"+263771000053", parent:"Douglas Matongo",   pp:"+263771000054" },
  // Form 6
  { first:"Panashe",   last:"Chiremba",   dob:"2007-05-28", gender:"Male",   form:"6",  class:"6A",  phone:"+263771000055", parent:"Beauty Chiremba",   pp:"+263771000056" },
  { first:"Fadzai",    last:"Machingura", dob:"2007-10-14", gender:"Female", form:"6",  class:"6A",  phone:"+263771000057", parent:"Courage Machingura",pp:"+263771000058" },
  { first:"Tazviona",  last:"Mapuranga",  dob:"2007-03-06", gender:"Male",   form:"6",  class:"6A",  phone:"+263771000059", parent:"Loveness Mapuranga",pp:"+263771000060" },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log("🌱 Seeding Still Waters SIS database...\n");
    await client.query("BEGIN");

    // ── 1. Users ──────────────────────────────────────────────────────────────
    console.log("👤 Creating user accounts...");
    const USERS = [
      { username:"admin",      password:"admin123",     full_name:"System Administrator",  email:"admin@stillwaters.co.zw",       role:"admin",      campus:"swla",  is_approved:true  },
      { username:"principal",  password:"principal123", full_name:"Mr. N. Mavhondo",       email:"principal@stillwaters.co.zw",   role:"principal",  campus:"swla",  is_approved:true  },
      { username:"teacher1",   password:"password123",  full_name:"Mrs. T. Moyo",          email:"tmoyo@stillwaters.co.zw",       role:"teacher",    campus:"swla",  is_approved:true  },
      { username:"teacher2",   password:"password123",  full_name:"Mr. S. Chikwanda",      email:"schikwanda@stillwaters.co.zw",  role:"teacher",    campus:"swla",  is_approved:true  },
      { username:"accountant", password:"accounts123",  full_name:"Mrs. R. Dube",          email:"accounts@stillwaters.co.zw",    role:"accountant", campus:"swla",  is_approved:true  },
      { username:"admin2",     password:"admin123",     full_name:"SWCHS Administrator",   email:"admin@swchs.co.zw",             role:"admin",      campus:"swchs", is_approved:true  },
    ];
    const userIds = {};
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      const res = await client.query(
        `INSERT INTO users (username,password_hash,full_name,email,role,campus,is_approved)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [u.username, hash, u.full_name, u.email, u.role, u.campus, u.is_approved]
      );
      userIds[u.username] = res.rows[0].id;
    }
    console.log(`   ✓ ${USERS.length} users created`);

    // ── 2. Subjects ───────────────────────────────────────────────────────────
    console.log("📚 Inserting subjects...");
    const subjectIds = {};
    for (const s of SUBJECTS) {
      const res = await client.query(
        `INSERT INTO subjects (name, code, curriculum) VALUES ($1,$2,$3) RETURNING id`,
        [s.name, s.code, s.curriculum]
      );
      subjectIds[s.code] = res.rows[0].id;
    }
    console.log(`   ✓ ${SUBJECTS.length} subjects created`);

    // ── 3. Students ───────────────────────────────────────────────────────────
    console.log("🎓 Enrolling students...");
    const studentIds = [];
    const studentForms = [];
    for (let i = 0; i < STUDENTS.length; i++) {
      const s = STUDENTS[i];
      const sid = String(i + 1).padStart(4, "0");
      const res = await client.query(
        `INSERT INTO students
           (student_id,first_name,last_name,date_of_birth,gender,form,class,campus,
            status,phone,parent_name,parent_phone,enroll_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'swla','Active',$8,$9,$10,CURRENT_DATE) RETURNING id`,
        [sid, s.first, s.last, s.dob, s.gender, s.form, s.class, s.phone, s.parent, s.pp]
      );
      studentIds.push(res.rows[0].id);
      studentForms.push(s.form);
    }
    console.log(`   ✓ ${STUDENTS.length} students enrolled`);

    // ── 4. Attendance (last 10 school days) ───────────────────────────────────
    console.log("📅 Generating attendance records...");
    let attCount = 0;
    const today = new Date();
    const schoolDays = [];
    let d = new Date(today);
    while (schoolDays.length < 10) {
      d.setDate(d.getDate() - 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        schoolDays.push(d.toISOString().split("T")[0]);
      }
    }
    for (const date of schoolDays) {
      for (let i = 0; i < studentIds.length; i++) {
        const status = Math.random() > 0.12 ? "Present" : "Absent";
        await client.query(
          `INSERT INTO attendance (student_id, date, status, marked_by, campus)
           VALUES ($1,$2,$3,$4,'swla') ON CONFLICT DO NOTHING`,
          [studentIds[i], date, status, userIds["teacher1"]]
        );
        attCount++;
      }
    }
    console.log(`   ✓ ${attCount} attendance records created`);

    // ── 5. Results (Term 1 2026 — Form 5 from Mark Reader sample) ─────────────
    console.log("📝 Entering results...");
    let resultCount = 0;

    // Get subject IDs for Form 5 (ZIMSEC A-Level)
    const f5Subjects = SUBJECTS
      .filter(s => s.curriculum === "ZIMSEC_A")
      .slice(0, 5); // English, History, Literature, FRS, Business

    // Form 5 mark reader (from the sample document)
    const form5Marks = {
      "Mukonda": { "ZMSCA-008":69, "ZMSCA-002":65, "ZMSCA-006":64, "ZMSCA-011":61 },
    };

    for (let i = 0; i < studentIds.length; i++) {
      const form = studentForms[i];
      const curriculum = getCurriculum(form);

      // Pick subjects for this form
      let formSubjects;
      if (["3C","4C"].includes(form)) {
        formSubjects = SUBJECTS.filter(s => s.curriculum === "CAMBRIDGE_O").slice(0, 6);
      } else if (["5","6"].includes(form)) {
        formSubjects = SUBJECTS.filter(s => s.curriculum === "ZIMSEC_A").slice(0, 5);
      } else {
        formSubjects = SUBJECTS.filter(s => s.curriculum === "ZIMSEC_O").slice(0, 8);
      }

      for (const subj of formSubjects) {
        const mark = Math.floor(Math.random() * 45) + 40; // 40-85
        const grade = calcGrade(mark, subj.curriculum);
        const remarks = getRemarks(grade, subj.curriculum);

        // Find subject id
        const subjRow = await client.query(
          `SELECT id FROM subjects WHERE code = $1`, [subj.code]
        );
        if (!subjRow.rows.length) continue;
        const subjId = subjRow.rows[0].id;

        await client.query(
          `INSERT INTO results (student_id,subject_id,term,year,report_type,mark,grade,remarks,entered_by)
           VALUES ($1,$2,'Term 1',2026,'term_report',$3,$4,$5,$6)
           ON CONFLICT DO NOTHING`,
          [studentIds[i], subjId, mark, grade, remarks, userIds["teacher1"]]
        );

        // Also add mark reader entry
        const effort = Math.floor(Math.random() * 3) + 1; // 1-3
        const classAvg = Math.floor(Math.random() * 20) + 50;
        await client.query(
          `INSERT INTO results (student_id,subject_id,term,year,report_type,mark,effort,class_average,grade,remarks,entered_by)
           VALUES ($1,$2,'Term 1',2026,'mark_reader',$3,$4,$5,$6,$7,$8)
           ON CONFLICT DO NOTHING`,
          [studentIds[i], subjId, mark, effort, classAvg, grade, remarks, userIds["teacher1"]]
        );
        resultCount += 2;
      }
    }
    console.log(`   ✓ ${resultCount} result entries created`);

    // ── 6. Invoices & Payments ────────────────────────────────────────────────
    console.log("💰 Generating invoices...");
    let invoiceCount = 0;
    // Receipt numbers start at 34828 (from their actual receipts)
    let receiptNum = 34828;

    for (let i = 0; i < studentIds.length; i++) {
      const form = studentForms[i];
      // F1-4: standard fees, F5-6: higher fees
      const isUpper = ["5","6"].includes(form);
      const tuition     = isUpper ? 650 : 500;
      const levy        = 50;
      const boarding    = Math.random() > 0.6 ? 400 : 0; // ~40% boarders
      const registration = i < 5 ? 250 : 0; // new students only
      const amountDue = tuition + levy + boarding + registration;

      // Some paid, some partial, some unpaid
      const rand = Math.random();
      let amountPaid = 0;
      let status = "Unpaid";
      if (rand > 0.6) { amountPaid = amountDue; status = "Paid"; }
      else if (rand > 0.35) { amountPaid = Math.floor(amountDue * 0.5); status = "Partial"; }

      const invoiceNo = String(receiptNum + i);
      const dueDate = new Date("2026-01-14");

      const invRes = await client.query(
        `INSERT INTO invoices
           (invoice_no,student_id,term,year,campus,tuition,levy,boarding,registration,
            amount_due,amount_paid,status,due_date,created_by)
         VALUES ($1,$2,'Term 1',2026,'swla',$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [invoiceNo, studentIds[i], tuition, levy, boarding, registration,
         amountDue, amountPaid, status, dueDate, userIds["accountant"]]
      );

      if (amountPaid > 0) {
        await client.query(
          `INSERT INTO payments (invoice_id,amount,payment_method,payment_date,received_by,receipt_no)
           VALUES ($1,$2,'Cash',CURRENT_DATE,$3,$4)`,
          [invRes.rows[0].id, amountPaid, userIds["accountant"], invoiceNo]
        );
      }
      invoiceCount++;
    }
    console.log(`   ✓ ${invoiceCount} invoices created`);

    // ── 7. Sample Assets ──────────────────────────────────────────────────────
    console.log("🏢 Adding asset register...");
    const ASSETS = [
      { asset_id:"AST001", name:"Dell Laptop (Admin)",          category:"ICT Equipment",    condition:"Good", location:"Admin Office",    value:450  },
      { asset_id:"AST002", name:"Epson Projector",              category:"AV Equipment",     condition:"Good", location:"Form 5 Class",    value:320  },
      { asset_id:"AST003", name:"Science Lab Tables (x6)",      category:"Furniture",        condition:"Fair", location:"Science Lab",     value:600  },
      { asset_id:"AST004", name:"Library Books — Set A",        category:"Books",            condition:"Good", location:"Library",         value:780  },
      { asset_id:"AST005", name:"Generator (8kVA)",             category:"Equipment",        condition:"Good", location:"Generator Room",  value:1200 },
      { asset_id:"AST006", name:"PA System & Speakers",         category:"AV Equipment",     condition:"Good", location:"Assembly Hall",   value:850  },
      { asset_id:"AST007", name:"Printer (HP LaserJet)",        category:"ICT Equipment",    condition:"Fair", location:"Admin Office",    value:180  },
      { asset_id:"AST008", name:"Student Desks & Chairs (x30)", category:"Furniture",        condition:"Good", location:"Form 1 Class",    value:900  },
      { asset_id:"AST009", name:"Whiteboard (Large)",           category:"Equipment",        condition:"Good", location:"Form 3C Class",   value:120  },
      { asset_id:"AST010", name:"First Aid Kit",                category:"Medical",          condition:"Good", location:"Admin Office",    value:45   },
    ];
    for (const a of ASSETS) {
      await client.query(
        `INSERT INTO assets (asset_id,name,category,condition,location,value,campus,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'swla',$7) ON CONFLICT DO NOTHING`,
        [a.asset_id, a.name, a.category, a.condition, a.location, a.value, userIds["admin"]]
      );
    }
    console.log(`   ✓ ${ASSETS.length} assets registered`);

    // ── 8. Sample Notices ─────────────────────────────────────────────────────
    console.log("📢 Adding notice board entries...");
    const NOTICES = [
      { title:"Term 2 Opening Date", content:"Term 2 will begin on 5 May 2026. All learners are expected to report by 7:00 AM on the first day. Fees must be paid before or on the first day of term.", target_roles:"all" },
      { title:"Parents Evening — Form 4 & 6", content:"A parents evening for Form 4 and Form 6 learners will be held on 28 March 2026 from 14:00 to 17:00. All parents are encouraged to attend.", target_roles:"parent,teacher,principal" },
      { title:"Staff Meeting", content:"A compulsory staff meeting will be held on Friday 20 March 2026 at 15:30 in the staffroom. All teaching staff must attend.", target_roles:"teacher,principal,admin" },
    ];
    for (const n of NOTICES) {
      await client.query(
        `INSERT INTO notices (title,content,campus,target_roles,created_by,is_active)
         VALUES ($1,$2,'swla',$3,$4,true)`,
        [n.title, n.content, n.target_roles, userIds["admin"]]
      );
    }
    console.log(`   ✓ ${NOTICES.length} notices posted`);

    // ── 9. Teacher class assignments ──────────────────────────────────────────
    const forms1to4 = ["1","2","3Z","4Z"];
    for (const form of forms1to4) {
      await client.query(
        `INSERT INTO teacher_classes (teacher_user_id,form,campus,academic_year)
         VALUES ($1,$2,'swla',2026) ON CONFLICT DO NOTHING`,
        [userIds["teacher1"], form]
      );
    }
    await client.query(
      `INSERT INTO teacher_classes (teacher_user_id,form,campus,academic_year)
       VALUES ($1,'5','swla',2026),($1,'6','swla',2026) ON CONFLICT DO NOTHING`,
      [userIds["teacher2"]]
    );
    console.log("   ✓ Teacher class assignments done");

    await client.query("COMMIT");

    console.log("\n✅ Still Waters SIS database seeded successfully!");
    console.log("─".repeat(50));
    console.log("Login credentials:");
    console.log("  Admin:       admin        / admin123");
    console.log("  Principal:   principal    / principal123");
    console.log("  Teacher:     teacher1     / password123");
    console.log("  Accountant:  accountant   / accounts123");
    console.log("─".repeat(50));

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
