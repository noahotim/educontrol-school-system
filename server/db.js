const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/school.db');
fs.mkdirSync(path.dirname(dbPath), {recursive:true});
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init(){
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    name TEXT,
    email TEXT,
    must_change_password INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admission_no TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT,
    dob TEXT,
    class TEXT,
    stream TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    parent_email TEXT,
    address TEXT,
    admission_date TEXT,
    status TEXT DEFAULT 'Active',
    photo TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    gender TEXT,
    department TEXT,
    role TEXT,
    phone TEXT,
    email TEXT,
    qualification TEXT,
    salary REAL DEFAULT 0,
    hire_date TEXT,
    status TEXT DEFAULT 'Active',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    remarks TEXT,
    UNIQUE(student_id, date)
  );
  CREATE TABLE IF NOT EXISTS staff_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    UNIQUE(staff_id, date)
  );
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    teacher TEXT,
    capacity INTEGER,
    room TEXT
  );
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE,
    department TEXT
  );
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    term TEXT,
    year TEXT,
    class TEXT,
    date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject TEXT,
    marks REAL,
    grade TEXT,
    remarks TEXT,
    UNIQUE(exam_id, student_id, subject)
  );
  CREATE TABLE IF NOT EXISTS fees_structure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT,
    term TEXT,
    amount REAL,
    description TEXT,
    due_date TEXT
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    method TEXT,
    receipt_no TEXT UNIQUE,
    term TEXT,
    date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    description TEXT,
    amount REAL,
    date TEXT,
    paid_by TEXT,
    receipt TEXT
  );
  CREATE TABLE IF NOT EXISTS incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    description TEXT,
    amount REAL,
    date TEXT
  );
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    address TEXT,
    category TEXT
  );
  CREATE TABLE IF NOT EXISTS requisitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item TEXT NOT NULL,
    quantity INTEGER,
    requested_by TEXT,
    department TEXT,
    status TEXT DEFAULT 'Pending',
    date TEXT,
    approved_by TEXT
  );
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id),
    items TEXT,
    total REAL,
    status TEXT DEFAULT 'Pending',
    date TEXT
  );
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item TEXT UNIQUE NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 0,
    unit TEXT,
    unit_price REAL,
    location TEXT,
    low_stock INTEGER DEFAULT 10
  );
  CREATE TABLE IF NOT EXISTS goods_received (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER REFERENCES purchase_orders(id),
    items TEXT,
    received_by TEXT,
    date TEXT
  );
  CREATE TABLE IF NOT EXISTS medical_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    visit_date TEXT,
    symptoms TEXT,
    diagnosis TEXT,
    treatment TEXT,
    prescribed TEXT,
    nurse TEXT,
    status TEXT DEFAULT 'Treated'
  );
  CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    quantity INTEGER,
    unit TEXT,
    expiry TEXT,
    supplier TEXT
  );
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reg_no TEXT UNIQUE NOT NULL,
    type TEXT,
    capacity INTEGER,
    driver TEXT,
    status TEXT DEFAULT 'Active'
  );
  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    license TEXT,
    vehicle_id INTEGER REFERENCES vehicles(id)
  );
  CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    stops TEXT,
    fee REAL,
    vehicle_id INTEGER REFERENCES vehicles(id)
  );
  CREATE TABLE IF NOT EXISTS transport_reg (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    route_id INTEGER REFERENCES routes(id),
    pickup TEXT,
    UNIQUE(student_id)
  );
  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER REFERENCES routes(id),
    date TEXT,
    status TEXT,
    remarks TEXT
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT,
    start_date TEXT,
    end_date TEXT,
    venue TEXT,
    description TEXT,
    audience TEXT
  );
  CREATE TABLE IF NOT EXISTS sms_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT,
    phone TEXT,
    message TEXT,
    type TEXT,
    status TEXT DEFAULT 'Sent',
    date TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    month TEXT,
    basic REAL,
    allowances REAL,
    deductions REAL,
    net REAL,
    status TEXT DEFAULT 'Paid',
    UNIQUE(staff_id, month)
  );
  CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id),
    from_class TEXT,
    to_class TEXT,
    year TEXT,
    date TEXT
  );
  CREATE TABLE IF NOT EXISTS teacher_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    class TEXT NOT NULL,
    UNIQUE(user_id, subject, class)
  );
  CREATE TABLE IF NOT EXISTS compiled_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    total REAL,
    average REAL,
    aggregate INTEGER,
    division TEXT,
    position INTEGER,
    compiled_at TEXT DEFAULT (datetime('now')),
    UNIQUE(exam_id, student_id)
  );
  `);
  // ensure admin user
  const row = db.prepare('SELECT id FROM users WHERE username=?').get('admin');
  if(!row){
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username,password,role,name,email) VALUES (?,?,?,?,?)').run('admin',hash,'admin','System Administrator','admin@school.local');
    console.log('Default admin created: admin / admin123');
  }
  // ensure default classes
  const c = db.prepare('SELECT count(*) as n FROM classes').get();
  if(c.n===0){
    ['Baby Class','Middle Class','Top Class','P1','P2','P3','P4','P5','P6','P7','S1','S2','S3','S4','S5','S6'].forEach(n=> db.prepare('INSERT OR IGNORE INTO classes (name,capacity) VALUES (?,?)').run(n,40));
  }
  const s = db.prepare('SELECT count(*) as n FROM subjects').get();
  if(s.n===0){
    ['Mathematics','English','Science','Social Studies','RE','Art','Music','PE','ICT','Agriculture','Commerce','Physics','Chemistry','Biology','History','Geography','Literature'].forEach(n=> db.prepare('INSERT OR IGNORE INTO subjects (name,code) VALUES (?,?)').run(n, n.slice(0,3).toUpperCase()));
  }
  // ensure class_teacher & subject_teacher demo users
  try{
    const bcrypt=require('bcryptjs');
    const add=(u,p,r,nm)=>{ if(!db.prepare('SELECT id FROM users WHERE username=?').get(u)){ const h=bcrypt.hashSync(p,10); db.prepare('INSERT INTO users (username,password,role,name,email) VALUES (?,?,?,?,?)').run(u,h,r,nm,u+'@school.local'); console.log('Created '+u+' / '+p); } };
    add('classteacher','class123','class_teacher','Ms. Nalwoga (Class Teacher)');
    add('subjectteacher','subject123','subject_teacher','Mr. Tumusiime (Subject Teacher)');
    // auto-assign subjects to subject teacher for demo
    const st=db.prepare('SELECT id FROM users WHERE username=?').get('subjectteacher');
    if(st){
      const cnt=db.prepare('SELECT count(*) as n FROM teacher_assignments WHERE user_id=?').get(st.id).n;
      if(cnt===0){
        [['Mathematics','P5'],['Mathematics','P6'],['Science','P5'],['English','P5']].forEach(([sub,cls])=>{ try{ db.prepare('INSERT OR IGNORE INTO teacher_assignments (user_id,subject,class) VALUES (?,?,?)').run(st.id,sub,cls);}catch(e){} });
      }
    }
    const ct=db.prepare('SELECT id FROM users WHERE username=?').get('classteacher');
    if(ct){
      const cnt2=db.prepare('SELECT count(*) as n FROM teacher_assignments WHERE user_id=?').get(ct.id).n;
      if(cnt2===0){
        [['P5','P5'],['P5','P6']].forEach(([sub,cls])=>{ try{ db.prepare('INSERT OR IGNORE INTO teacher_assignments (user_id,subject,class) VALUES (?,?,?)').run(ct.id,sub,cls);}catch(e){} });
        // class teacher assigned to class P5
        try{ db.prepare('INSERT OR IGNORE INTO teacher_assignments (user_id,subject,class) VALUES (?,?,?)').run(ct.id,'ALL','P5'); }catch(e){}
      }
    }
  }catch(e){ console.log('seed teachers',e.message); }
  // ensure maintenance table
  try{ db.exec(`CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY CHECK (id=1), enabled INTEGER DEFAULT 0, message TEXT DEFAULT 'Access to this system is temporarily locked.\nCONTACT NOAH to be authorised.', enabled_by TEXT, enabled_at TEXT, enabled_until TEXT)`); const m=db.prepare('SELECT * FROM maintenance WHERE id=1').get(); if(!m) db.prepare('INSERT INTO maintenance (id,enabled,message) VALUES (1,0,?)').run('Access to this system is temporarily locked.\nCONTACT NOAH to be authorised.'); }catch(e){ console.log('maintenance table',e.message); }
  try{ db.exec(`ALTER TABLE maintenance ADD COLUMN enabled_until TEXT`); }catch(e){}
  // ensure must_change_password column (for existing DBs)
  try{ db.exec(`ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0`); }catch(e){}
  // scalable school levels — P1-P7 primary now, S1-S6 secondary ready
  try{
    db.exec(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);
    const lvl=db.prepare('SELECT * FROM system_settings WHERE key=?').get('school_level');
    if(!lvl) db.prepare('INSERT INTO system_settings (key,value,updated_at) VALUES (?,?,?)').run('school_level','primary',new Date().toISOString());
    const active=db.prepare('SELECT * FROM system_settings WHERE key=?').get('active_classes');
    if(!active){
      // P1-P7 active now, S1-S6 ready but inactive (scalable)
      const pClasses=['P1','P2','P3','P4','P5','P6','P7'];
      db.prepare('INSERT INTO system_settings (key,value,updated_at) VALUES (?,?,?)').run('active_classes', JSON.stringify(pClasses), new Date().toISOString());
    }
    // ensure all classes exist (both primary + secondary for future)
    const allNeeded=['P1','P2','P3','P4','P5','P6','P7','S1','S2','S3','S4','S5','S6','Baby Class','Middle Class','Top Class'];
    allNeeded.forEach(n=>{ try{ db.prepare('INSERT OR IGNORE INTO classes (name,capacity) VALUES (?,?)').run(n,40); }catch(e){} });
  }catch(e){ console.log('scalable settings',e.message); }
}
init();
module.exports = db;
