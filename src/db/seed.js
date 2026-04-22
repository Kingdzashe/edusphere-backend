// src/db/seed.js — Still Waters Group of Schools
// Real student data seed — replaces all demo data
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const connectionConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "stillwaters_sis",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
    };

const client = new Client(connectionConfig);

// ─── Users ────────────────────────────────────────────────────────────────────
const USERS = [
  { username:"admin",         password:"admin123",       full_name:"Administrator",                     email:"admin@stillwaters.ac.zw",         role:"admin",      campus:"swla", is_approved:true },
  { username:"admin2",        password:"admin123",       full_name:"Administrator (SWCHS)",             email:"admin2@stillwaters.ac.zw",        role:"admin",      campus:"swchs",is_approved:true },
  { username:"principal",     password:"principal123",   full_name:"The Principal",                     email:"principal@stillwaters.ac.zw",     role:"principal",  campus:"swla", is_approved:true },
  { username:"accountant",    password:"accounts123",    full_name:"Accounts Office",                   email:"accounts@stillwaters.ac.zw",      role:"accountant", campus:"swla", is_approved:true },
  // Teachers — one per subject
  { username:"t.mathematics", password:"maths2026",      full_name:"Mathematics Teacher",               email:"maths@stillwaters.ac.zw",         role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.english",     password:"english2026",    full_name:"English Language Teacher",          email:"english@stillwaters.ac.zw",       role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.shona",       password:"shona2026",      full_name:"Shona Teacher",                     email:"shona@stillwaters.ac.zw",         role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.science",     password:"science2026",    full_name:"Combined Science Teacher",          email:"science@stillwaters.ac.zw",       role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.geography",   password:"geo2026",        full_name:"Geography Teacher",                 email:"geography@stillwaters.ac.zw",     role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.history",     password:"history2026",    full_name:"History Teacher",                   email:"history@stillwaters.ac.zw",       role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.frs",         password:"frs2026",        full_name:"Family & Religious Studies Teacher",email:"frs@stillwaters.ac.zw",           role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.accounts",    password:"accounts2026",   full_name:"Principles of Accounts Teacher",   email:"poa@stillwaters.ac.zw",           role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.bes",         password:"bes2026",        full_name:"Business Enterprise & Skills Teacher",email:"bes@stillwaters.ac.zw",        role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.biology",     password:"bio2026",        full_name:"Biology Teacher",                   email:"biology@stillwaters.ac.zw",       role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.chemistry",   password:"chem2026",       full_name:"Chemistry Teacher",                 email:"chemistry@stillwaters.ac.zw",     role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.literature",  password:"lit2026",        full_name:"Literature in English Teacher",     email:"literature@stillwaters.ac.zw",    role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.economics",   password:"econ2026",       full_name:"Economics Teacher",                 email:"economics@stillwaters.ac.zw",     role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.comms",       password:"comms2026",      full_name:"Communication Skills Teacher",      email:"comms@stillwaters.ac.zw",         role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.ict",         password:"ict2026",        full_name:"ICT Teacher",                       email:"ict@stillwaters.ac.zw",           role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.physics",     password:"physics2026",    full_name:"Physics Teacher",                   email:"physics@stillwaters.ac.zw",       role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.accounting",  password:"acctg2026",      full_name:"Accounting Teacher",                email:"accounting@stillwaters.ac.zw",    role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.bizstudies",  password:"bizst2026",      full_name:"Business Studies Teacher",          email:"bizstudies@stillwaters.ac.zw",    role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.relstudies",  password:"relst2026",      full_name:"Religious Studies Teacher",         email:"relstudies@stillwaters.ac.zw",    role:"teacher",    campus:"swla", is_approved:true },
  { username:"t.biblestudies",password:"bible2026",      full_name:"Biblical Studies Teacher",          email:"bible@stillwaters.ac.zw",         role:"teacher",    campus:"swla", is_approved:true },
];

// ─── Subjects ─────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { name:"Mathematics",                          code:"ZMSCO-001", curriculum:"ZIMSEC_O" },
  { name:"English Language",                     code:"ZMSCO-002", curriculum:"ZIMSEC_O" },
  { name:"Shona",                                code:"ZMSCO-003", curriculum:"ZIMSEC_O" },
  { name:"Combined Science",                     code:"ZMSCO-004", curriculum:"ZIMSEC_O" },
  { name:"Geography",                            code:"ZMSCO-005", curriculum:"ZIMSEC_O" },
  { name:"History",                              code:"ZMSCO-006", curriculum:"ZIMSEC_O" },
  { name:"Family & Religious Studies",           code:"ZMSCO-007", curriculum:"ZIMSEC_O" },
  { name:"Principles of Accounts",               code:"ZMSCO-008", curriculum:"ZIMSEC_O" },
  { name:"Business Enterprise & Skills",         code:"ZMSCO-009", curriculum:"ZIMSEC_O" },
  { name:"Biology",                              code:"ZMSCO-010", curriculum:"ZIMSEC_O" },
  { name:"Chemistry",                            code:"ZMSCO-011", curriculum:"ZIMSEC_O" },
  { name:"Literature in English",                code:"ZMSCO-012", curriculum:"ZIMSEC_O" },
  { name:"Economics",                            code:"ZMSCO-013", curriculum:"ZIMSEC_O" },
  { name:"Communication Skills",                 code:"ZMSCO-014", curriculum:"ZIMSEC_O" },
  { name:"Information & Communication Technology",code:"ZMSCO-015", curriculum:"ZIMSEC_O" },
  { name:"Mathematics (A-Level)",                code:"ZMSCA-001", curriculum:"ZIMSEC_A" },
  { name:"English Language (A-Level)",           code:"ZMSCA-002", curriculum:"ZIMSEC_A" },
  { name:"Biology (A-Level)",                    code:"ZMSCA-003", curriculum:"ZIMSEC_A" },
  { name:"Chemistry (A-Level)",                  code:"ZMSCA-004", curriculum:"ZIMSEC_A" },
  { name:"Physics (A-Level)",                    code:"ZMSCA-005", curriculum:"ZIMSEC_A" },
  { name:"History (A-Level)",                    code:"ZMSCA-006", curriculum:"ZIMSEC_A" },
  { name:"Economics (A-Level)",                  code:"ZMSCA-007", curriculum:"ZIMSEC_A" },
  { name:"Accounting (A-Level)",                 code:"ZMSCA-008", curriculum:"ZIMSEC_A" },
  { name:"Geography (A-Level)",                  code:"ZMSCA-009", curriculum:"ZIMSEC_A" },
  { name:"Family & Religious Studies (A-Level)", code:"ZMSCA-010", curriculum:"ZIMSEC_A" },
  { name:"Literature in English (A-Level)",      code:"ZMSCA-011", curriculum:"ZIMSEC_A" },
  { name:"Mathematics",                          code:"CAMBO-001", curriculum:"CAMBRIDGE_O" },
  { name:"English Language",                     code:"CAMBO-002", curriculum:"CAMBRIDGE_O" },
  { name:"Combined Science",                     code:"CAMBO-003", curriculum:"CAMBRIDGE_O" },
  { name:"Geography",                            code:"CAMBO-004", curriculum:"CAMBRIDGE_O" },
  { name:"History",                              code:"CAMBO-005", curriculum:"CAMBRIDGE_O" },
  { name:"Religious Studies",                    code:"CAMBO-006", curriculum:"CAMBRIDGE_O" },
  { name:"Principles of Accounts",               code:"CAMBO-007", curriculum:"CAMBRIDGE_O" },
  { name:"Business Studies",                     code:"CAMBO-008", curriculum:"CAMBRIDGE_O" },
  { name:"Biology",                              code:"CAMBO-009", curriculum:"CAMBRIDGE_O" },
  { name:"Chemistry",                            code:"CAMBO-010", curriculum:"CAMBRIDGE_O" },
  { name:"Literature in English",                code:"CAMBO-011", curriculum:"CAMBRIDGE_O" },
  { name:"Economics",                            code:"CAMBO-012", curriculum:"CAMBRIDGE_O" },
  { name:"Biblical Studies",                     code:"CAMBO-013", curriculum:"CAMBRIDGE_O" },
  { name:"Mathematics (Cambridge A-Level)",      code:"CAMBA-001", curriculum:"CAMBRIDGE_A" },
  { name:"Biology (Cambridge A-Level)",          code:"CAMBA-002", curriculum:"CAMBRIDGE_A" },
  { name:"Chemistry (Cambridge A-Level)",        code:"CAMBA-003", curriculum:"CAMBRIDGE_A" },
  { name:"Economics (Cambridge A-Level)",        code:"CAMBA-004", curriculum:"CAMBRIDGE_A" },
  { name:"Business Studies (Cambridge A-Level)", code:"CAMBA-005", curriculum:"CAMBRIDGE_A" },
];

// ─── Real Students ────────────────────────────────────────────────────────────
const STUDENTS = [
  // Form 1
  { firstName:"NEMANGANDU",   lastName:"MUNOTIDA",       dob:"2012-05-19", gender:"Female", form:"1", email:"mreasyautohard@gmail.com",        address:"16875 DAMAFALLS PHASE 2 RUWA",          parentPhone:"0773056745" },
  { firstName:"MUKANDI",      lastName:"CARLSON",        dob:"2012-04-19", gender:"Male",   form:"1", email:"calton@freightworld.co.zw",        address:"15038 PHASE 1, DAMAFALLS RUWA",         parentPhone:"0772397032" },
  { firstName:"TSURO",        lastName:"RUFARO",         dob:"2013-02-11", gender:"Male",   form:"1", email:"ptsuro@gmail.com",                 address:"6729 ZIMRE PARK",                       parentPhone:"0773524454" },
  { firstName:"CHIBAMU",      lastName:"NOKUTENDA",      dob:"2012-02-14", gender:"Female", form:"1", email:"estermusunge22@gmail.com",         address:"CHIBAMU VILLAGE GOROMONZI",             parentPhone:"0776830042" },
  { firstName:"TIGERE VICTORIA",lastName:"REJOICE",      dob:"2013-04-02", gender:"Female", form:"1", email:null,                              address:"6824 SHAMBA HILLS ZIMRE PARK",          parentPhone:"0777058113" },
  { firstName:"ETHAN",        lastName:"MAKUTO",         dob:"2013-04-13", gender:"Male",   form:"1", email:"chidauv@gmail.com",                address:"671 PARERENYATWA WINDSOR PARK",         parentPhone:"0784596250" },
  { firstName:"RUVIMBO",      lastName:"MAUNGWA",        dob:null,         gender:"Female", form:"1", email:null,                              address:null,                                    parentPhone:null },
  { firstName:"DEAN",         lastName:"MUSHUNJE",       dob:null,         gender:"Male",   form:"1", email:null,                              address:null,                                    parentPhone:null },
  // Form 2
  { firstName:"MUSANHU",      lastName:"ANGEL",          dob:"2011-01-25", gender:"Female", form:"2", email:"fidelismus@gmail.com",             address:"48717 NZOU WINDSOR PARK",               parentPhone:"0782526286" },
  { firstName:"NYAMATANGA",   lastName:"RUVARASHE",      dob:"2011-09-24", gender:"Female", form:"2", email:"obeynyamatanga@gmail.com",         address:"6787 SOUTHVIEW PARK HARARE",            parentPhone:"0773302663" },
  { firstName:"ZHAKKATA",     lastName:"ROPAFADZO",      dob:"2011-09-05", gender:"Female", form:"2", email:null,                              address:"6686 EMERALD RD, ZIMRE PARK RUWA",      parentPhone:"0772688093" },
  { firstName:"MACHISA",      lastName:"CHIEDZA",        dob:"2012-05-11", gender:"Female", form:"2", email:"zvikomborerokamujoma@gmail.com",   address:null,                                    parentPhone:"0783527043" },
  { firstName:"MUSHAYAMANO",  lastName:"DIGNITY",        dob:"2011-08-25", gender:"Male",   form:"2", email:"wekwamushayamano@gmail.com",       address:"GLENVIEW 4",                            parentPhone:"0777896871" },
  { firstName:"SIZIBA",       lastName:"ASHTON",         dob:null,         gender:"Male",   form:"2", email:null,                              address:null,                                    parentPhone:null },
  { firstName:"MBOTO",        lastName:"TAWANANYASHA",   dob:"2011-03-03", gender:"Male",   form:"2", email:null,                              address:"24 STARLING GREENSIDE MUTARE",           parentPhone:"0773766460" },
  { firstName:"MUSHAKA",      lastName:"ABISAI",         dob:"2011-09-12", gender:"Male",   form:"2", email:null,                              address:"6308 MUZEZE ROAD ZIMRE PARK",            parentPhone:"0773279271" },
  // Form 3Z
  { firstName:"BHEBHE",       lastName:"NOBATHEMBU",     dob:"2010-11-10", gender:"Female", form:"3Z",email:"nyonisabel3@gmail.com",            address:"3780 ROCKVIEW PARK HARARE",             parentPhone:"0776303521" },
  { firstName:"BHEBHE",       lastName:"NTHUTHUKO",      dob:"2010-11-10", gender:"Male",   form:"3Z",email:"nyonisabel3@gmail.com",            address:"3780 ROCKVIEW PARK HARARE",             parentPhone:"0776303521" },
  { firstName:"BHEBHE",       lastName:"SAMATHA",        dob:"2010-10-08", gender:"Female", form:"3Z",email:"kaylachits1@gmail.com",            address:"6725 NYANGANI CLOSE ZIMRE PARK",        parentPhone:"0773462936" },
  { firstName:"DIRIKWI",      lastName:"PRAISE",         dob:"2010-08-01", gender:"Female", form:"3Z",email:"tatendadirik@gmail.com",           address:"G1 FOURMAIN STREET CHIVHU",             parentPhone:"0782411457" },
  { firstName:"NYONI",        lastName:"SAMANTHA",       dob:"2010-10-25", gender:"Female", form:"3Z",email:"washinyoni@gmail.com",             address:"4705 GLAUDIA PHASE 2 HARARE",           parentPhone:"0782986003" },
  { firstName:"NYANDORO",     lastName:"NANDIPA-ZOEY",   dob:"2011-01-12", gender:"Female", form:"3Z",email:"nchapwanya@gmail.com",             address:"3548 MKOBA 16 GWERU",                   parentPhone:"0773533795" },
  { firstName:"TEMBO",        lastName:"TANATSWA",       dob:"2010-09-16", gender:"Male",   form:"3Z",email:"tapstembo@gmail.com",              address:"3995 ROCKVIEW PARK EPWORTH HARARE",     parentPhone:"0772423531" },
  { firstName:"STANFORM",     lastName:"LIAM",           dob:"2010-10-23", gender:"Male",   form:"3Z",email:"stanfordAlbet19@gmail.com",        address:"12345 TIMIRE PARK RUWA",                parentPhone:"0773110758" },
  { firstName:"MATEPO",       lastName:"NEISHA",         dob:"2010-12-07", gender:"Female", form:"3Z",email:"jmatepo@gmail.com",                address:"32767 MABAZUVA ESTATE RUWA",            parentPhone:"0772363786" },
  { firstName:"MUSIYIWA",     lastName:"TADIWANASHE",    dob:"2009-03-28", gender:"Female", form:"3Z",email:null,                              address:"32108 MABVAZUVA PHASE 1:1 RUWA",        parentPhone:"0782357520" },
  { firstName:"WAYNE",        lastName:"NYAMAYARO",      dob:"2011-12-06", gender:"Male",   form:"3Z",email:"wellenskynyamayaro@gmail.com",     address:"1554 KUWADANA 7",                       parentPhone:"0773843209" },
  { firstName:"DENISE",       lastName:"MAHLENYIKA",     dob:"2010-04-25", gender:"Female", form:"3Z",email:null,                              address:null,                                    parentPhone:"0778366423" },
  { firstName:"SHONHIWA",     lastName:"TAWANANYASHA",   dob:"2008-09-23", gender:"Male",   form:"3Z",email:"fredalvintransport@gmail.com",     address:"29 MONDE ROAD MUFAKOSE HARARE",         parentPhone:"0772210324" },
  // Form 3C
  { firstName:"MAKORA",       lastName:"MAKANAKA",       dob:"2010-08-09", gender:"Female", form:"3C",email:"makora63@gmail.com",               address:"371 GOROMONZI, MAJURU 2",               parentPhone:"0775305904" },
  { firstName:"DEMAWATEMA",   lastName:"SHANNEL",        dob:"2011-08-29", gender:"Female", form:"3C",email:"demawatemajob@gmail.com",           address:"5635 C.GUMBO ZIMRE PARK",               parentPhone:"0789440272" },
  { firstName:"CHAKUDUNGA",   lastName:"ALEX",           dob:"2011-06-19", gender:"Male",   form:"3C",email:"agathad24@gmail.com",              address:"6222 NICOZ DIAMOND ZIMRE PARK",         parentPhone:"0772417993" },
  { firstName:"RAPOZO",       lastName:"GUNEVERE",       dob:"2011-02-11", gender:"Female", form:"3C",email:"samuelrapozo@gmail.com",            address:"6011 MUTSIMBA ROAD ZIMRE PARK",         parentPhone:"0772336571" },
  { firstName:"MUNDOZA",      lastName:"MICHAEL",        dob:"2011-07-03", gender:"Male",   form:"3C",email:"Ruwat20@gmail.com",                address:"5968 ZIMRE DRIVE",                      parentPhone:"0778416410" },
  { firstName:"MAUNGWA",      lastName:"TAWANANYASHA",   dob:"2010-12-31", gender:"Male",   form:"3C",email:"tawanaprasis@gmail.com",            address:"4193 ROCKVIEW PARK",                    parentPhone:"0772874530" },
  // Form 4Z
  { firstName:"MUKUTIRI",     lastName:"TINOVIMBA",      dob:"2010-05-19", gender:"Female", form:"4Z",email:"smukutiri@gmail.com",              address:"9508 CHIPUKUTU PARK",                   parentPhone:"0773813400" },
  { firstName:"SANDE",        lastName:"MAKATENDEKA",    dob:"2009-11-04", gender:"Female", form:"4Z",email:"priscasande9494@gmail.com",         address:"9494 CHIPUKUTU PARK RUWA",              parentPhone:"0772682585" },
  { firstName:"KAMBANJE",     lastName:"LINDSAY",        dob:"2010-02-11", gender:"Female", form:"4Z",email:"kambanjet@gmail.com",              address:"5848 MUFARINYA STREET ZIMRE PARK",      parentPhone:"0771253029" },
  { firstName:"GUMBOJENA",    lastName:"FRANK",          dob:"2010-09-17", gender:"Male",   form:"4Z",email:null,                              address:"3875 ROCKVIEW A",                       parentPhone:"0775078774" },
  { firstName:"MASHAWI",      lastName:"TRISH",          dob:"2009-07-31", gender:"Female", form:"4Z",email:"amashawi@firstpack.co.za",         address:"9917 TIMIRE PARK RUWA",                 parentPhone:"0779865181" },
  { firstName:"MAPOSA",       lastName:"MIKE",           dob:"2009-09-01", gender:"Male",   form:"4Z",email:null,                              address:"17106 DAMAFALLS PARK",                  parentPhone:"0772927465" },
  { firstName:"MUTENGA",      lastName:"RUI",            dob:"2008-10-13", gender:"Male",   form:"4Z",email:"morris.mutenga@schindter.com",     address:"17905 DAMAFALLS RUWA",                  parentPhone:"0773026443" },
  { firstName:"MUSHONGA",     lastName:"NYASHA",         dob:"2009-07-16", gender:"Female", form:"4Z",email:null,                              address:"7671 ZVOBJO CLOSE ZIMRE PARK",          parentPhone:"0772910122" },
  { firstName:"NHUNZVI",      lastName:"KUMBERLY",       dob:"2009-02-08", gender:"Female", form:"4Z",email:null,                              address:"8390 SOUTHVIEW FIDELITY",               parentPhone:"0772676704" },
  { firstName:"NYOKA",        lastName:"RYAN",           dob:"2010-12-09", gender:"Male",   form:"4Z",email:"arthurnyoka3@gmail.com",           address:"STAND 90 BHOGHERTY HILL BORROWDALE",   parentPhone:"0775809043" },
  { firstName:"MAREGERE",     lastName:"ASHLY",          dob:"2010-02-10", gender:"Female", form:"4Z",email:null,                              address:"QUARY FARM BOX 438",                    parentPhone:"0775964699" },
  { firstName:"MARIME",       lastName:"RYAN",           dob:"2008-12-08", gender:"Male",   form:"4Z",email:"tapiwamarime@gmail.com",           address:"11500 TIMIRE PARK RUWA",                parentPhone:"0775063728" },
  { firstName:"MAJONI",       lastName:"TANYARADZWA",    dob:"2010-05-31", gender:"Female", form:"4Z",email:"w.majoni@gmail.com",               address:"373 RETREAT WATERFALLS",                parentPhone:"0771851600" },
  { firstName:"MUKONYO",      lastName:"NOKUTENDA",      dob:"2009-09-02", gender:"Female", form:"4Z",email:null,                              address:"14-38TH CRES WARREN PARK",              parentPhone:"0778371603" },
  { firstName:"NYABVUDZI",    lastName:"THAPELO",        dob:"2009-06-16", gender:"Male",   form:"4Z",email:"mnyabvudzi@mipf.co.zw",            address:"15050 DAMAFALLS ZIMRE PARK",            parentPhone:"0772421534" },
  { firstName:"MAZARURA",     lastName:"TARISAI",        dob:"2010-08-18", gender:"Female", form:"4Z",email:"sa.mapuranga@yahoo.com",           address:null,                                    parentPhone:"0771418407" },
  { firstName:"NYAGANO",      lastName:"TAVONGA",        dob:"2009-04-24", gender:"Male",   form:"4Z",email:"nyaganos@gmail.com",               address:"6734 VUMBA ROAD ZIMRE PARK",            parentPhone:"0773970566" },
  { firstName:"KUNAKA",       lastName:"TANATSWA",       dob:"2008-01-09", gender:"Male",   form:"4Z",email:"prukunaka81@gmail.com",            address:"2148 JIROS JIRI ROAD RUWA",             parentPhone:"0772716552" },
  { firstName:"MUVHIYI",      lastName:"DONNEL",         dob:"2010-06-21", gender:"Male",   form:"4Z",email:"tigereevents@gmail.com",           address:"3955516 ROCKVIEW PARK",                 parentPhone:"0775379562" },
  { firstName:"KUTYAURIPO",   lastName:"MICHELLE",       dob:"2008-12-07", gender:"Female", form:"4Z",email:"marchkutyauripo@gmail.com",        address:"4435 ROCKVIEW 1D",                      parentPhone:"0772564920" },
  { firstName:"MANGWANYA",    lastName:"NICOLE",         dob:"2010-07-12", gender:"Female", form:"4Z",email:null,                              address:"16515 DAMAFALLS PHASE 3",               parentPhone:"0772400248" },
  { firstName:"MUWONWA",      lastName:"INYASHA",        dob:"2009-10-02", gender:"Female", form:"4Z",email:"imuwonwa@zimra.co.zw",             address:"400 POMONA BORROWDALE HARARE",          parentPhone:"0712903816" },
  { firstName:"CHENJERAI",    lastName:"TANAKA",         dob:"2010-04-05", gender:"Male",   form:"4Z",email:null,                              address:"24297 CHITUNGWIZA UNIT P",              parentPhone:"0775981910" },
  { firstName:"GUZHA",        lastName:"JOANA",          dob:"2008-09-02", gender:"Female", form:"4Z",email:"jguzha@yahoo.com",                address:"3864 ROCKVIEW PARK HARARE",             parentPhone:"0772366130" },
  { firstName:"CHIKUMIRA",    lastName:"CHARNTAILE",     dob:"2007-06-18", gender:"Female", form:"4Z",email:null,                              address:"6432 NICOZ DIAMOND ZIMRE PARK",         parentPhone:"0777893353" },
  // Form 5
  { firstName:"KUPAKWAPSHE",  lastName:"MATONGO",        dob:null,         gender:"Female", form:"5", email:"leeneamatongo2@gmail.com",         address:"LDV7 MVUMA",                            parentPhone:"0777039123" },
  { firstName:"CHIEDZA",      lastName:"BUNGU",          dob:"2009-10-12", gender:"Female", form:"5", email:null,                              address:"3917 OLD HIGHFIELDS HARARE",            parentPhone:"0784622493" },
  { firstName:"RYAN",         lastName:"MATONGO",        dob:"2008-11-12", gender:"Male",   form:"5", email:null,                              address:"17901 DAMAFALLS PHASE 4",               parentPhone:"0788276349" },
  { firstName:"TAWANANYASHA", lastName:"MARIGA",         dob:"2008-02-28", gender:"Male",   form:"5", email:"kudzayimaria@gmail.com",           address:"1 MUNRO ROAD CRAMBONE",                 parentPhone:"0773279520" },
  { firstName:"JACOB",        lastName:"CHARIMA",        dob:"2007-07-25", gender:"Male",   form:"5", email:null,                              address:"22523 EASTVIEW PHASE 17",               parentPhone:"0783999377" },
  { firstName:"SIBANDA",      lastName:"SAMUEL",         dob:"2009-02-22", gender:"Male",   form:"5", email:"kundaichanakira@gmail.com",        address:"6872 BUMHILLS ZIMRE PARK",              parentPhone:"0773775716" },
  { firstName:"MUKONDA",      lastName:"CHANTELL",       dob:"2005-12-16", gender:"Female", form:"5", email:null,                              address:"23745 DAMAFALLS PHASE 6",               parentPhone:"0772931060" },
  { firstName:"JUNIOR",       lastName:"MURANGANWA",     dob:null,         gender:"Male",   form:"5", email:null,                              address:null,                                    parentPhone:null },
  { firstName:"MAREPO",       lastName:"NICOLE",         dob:"2009-01-09", gender:"Female", form:"5", email:"jmatepo@gmail.com",               address:"32767 MABVAZUVA ESTATE HARARE",         parentPhone:"0772363786" },
  // Form 6
  { firstName:"CHINAMHORA",   lastName:"TAPIWA",         dob:"2007-10-22", gender:"Female", form:"6", email:null,                              address:null,                                    parentPhone:null },
  { firstName:"DENGA",        lastName:"TENDAI",         dob:"2007-06-27", gender:"Male",   form:"6", email:"denga@zimphos.co.zw",             address:"18342 DAMAFALLS RUWA",                  parentPhone:"0773445139" },
  { firstName:"MUTASA",       lastName:"PAIDAMOYO",      dob:"2007-04-12", gender:"Female", form:"6", email:"Pachavo.Mutasa@seedcogroup.com",   address:"14549 DAMAFALLS RUWA",                  parentPhone:"0772926807" },
  { firstName:"MUNDOZA",      lastName:"MICHAEL",        dob:"2008-05-27", gender:"Male",   form:"6", email:"Ruwat20@gmail.com",               address:"5968 ZIMRE DRIVE",                      parentPhone:"0778416410" },
  { firstName:"KAZINGIZI",    lastName:"ETHEL",          dob:"2005-09-05", gender:"Female", form:"6", email:null,                              address:null,                                    parentPhone:"0772267146" },
  { firstName:"NAISON",       lastName:"MAJONI",         dob:"2005-04-26", gender:"Male",   form:"6", email:"majonishelton6@gmail.com",         address:"707 S MALUNGA OLD WINDSOR RUWA",        parentPhone:"0772438381" },
  { firstName:"ZIJENA",       lastName:"JOSHUA",         dob:"2005-09-16", gender:"Male",   form:"6", email:"lenmutatanki@gmail.com",           address:"222 SAM NUJOMA 1 AVON GROVE AVONDALE", parentPhone:"0779245469" },
];

async function seed() {
  await client.connect();
  console.log("✅ Connected to database\n");

  try {
    await client.query("BEGIN");

    // ── 1. Clear existing data ────────────────────────────────────────────────
    console.log("🧹 Clearing existing data...");
    await client.query(`
      TRUNCATE TABLE audit_log, staff_leave, staff, timetable, teacher_subjects,
        teacher_classes, parent_student, payments, installment_plans, invoices,
        discipline, attendance, results, notices, assets, students, subjects, users
      RESTART IDENTITY CASCADE
    `);
    console.log("   ✓ All tables cleared\n");

    // ── 2. Users ──────────────────────────────────────────────────────────────
    console.log("👤 Creating user accounts...");
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
    console.log(`   ✓ ${USERS.length} accounts created\n`);

    // ── 3. Subjects ───────────────────────────────────────────────────────────
    console.log("📚 Creating subjects...");
    for (const s of SUBJECTS) {
      await client.query(
        `INSERT INTO subjects (name, code, curriculum) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [s.name, s.code, s.curriculum]
      );
    }
    console.log(`   ✓ ${SUBJECTS.length} subjects created\n`);

    // ── 4. Students ───────────────────────────────────────────────────────────
    console.log("🎓 Enrolling students...");
    let studentCount = 0;
    for (const s of STUDENTS) {
      studentCount++;
      const studentId = String(studentCount).padStart(4, "0");
      const cls = s.form; // class = form by default
      await client.query(
        `INSERT INTO students
           (student_id,first_name,last_name,date_of_birth,gender,form,class,campus,
            status,email,address,parent_phone,enroll_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'swla','Active',$8,$9,$10,CURRENT_DATE)`,
        [
          studentId,
          s.firstName.trim(),
          s.lastName.trim(),
          s.dob || null,
          s.gender ? s.gender.trim() : null,
          s.form,
          cls,
          s.email || null,
          s.address || null,
          s.parentPhone || null,
        ]
      );
    }
    console.log(`   ✓ ${studentCount} students enrolled\n`);

    await client.query("COMMIT");
    console.log("🎉 Seed complete!");
    console.log(`   Users:    ${USERS.length}`);
    console.log(`   Subjects: ${SUBJECTS.length}`);
    console.log(`   Students: ${studentCount}`);
    console.log("\n✅ Database is ready with real school data.");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err.message);
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
