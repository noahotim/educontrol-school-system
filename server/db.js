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
  CREATE TABLE IF NOT EXISTS teacher_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    class TEXT NOT NULL,
    UNIQUE(user_id, subject, class)
  );
   CREATE TABLE IF NOT EXISTS class_teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    from_class TEXT NOT NULL,
    to_class TEXT,
    year TEXT,
    term TEXT DEFAULT 'Term III',
    average REAL,
    recommendation TEXT,
    date TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    from_class TEXT NOT NULL,
    to_class TEXT,
    year TEXT,
    term TEXT DEFAULT 'Term III',
    average REAL,
    recommendation TEXT,
    date TEXT DEFAULT (datetime('now'))
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
  -- Production Exams & Results — POINT: Exams module upgrade
  CREATE TABLE IF NOT EXISTS exam_classes (
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    PRIMARY KEY (exam_id, class_id)
  );
  CREATE TABLE IF NOT EXISTS exam_streams (
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    stream_id INTEGER REFERENCES streams(id) ON DELETE CASCADE,
    PRIMARY KEY (exam_id, stream_id)
  );
  CREATE TABLE IF NOT EXISTS exam_subjects (
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    max_marks REAL DEFAULT 100,
    PRIMARY KEY (exam_id, subject_id)
  );
  CREATE TABLE IF NOT EXISTS exam_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id),
    marks REAL,
    grade TEXT,
    remark TEXT,
    status TEXT DEFAULT 'Present',
    entered_by INTEGER REFERENCES users(id),
    entered_at TEXT,
    UNIQUE(exam_id, student_id, subject_id)
  );
  CREATE TABLE IF NOT EXISTS exam_compiled_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    total REAL,
    average REAL,
    grade TEXT,
    aggregate REAL,
    division TEXT,
    position INTEGER,
    class_position INTEGER,
    stream_position INTEGER,
    class_name TEXT,
    stream_name TEXT,
    subject_count INTEGER,
    present_count INTEGER,
    compiled_at TEXT DEFAULT (datetime('now')),
    UNIQUE(exam_id, student_id)
  );
  CREATE TABLE IF NOT EXISTS exam_subject_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id),
    student_count INTEGER,
    entered_count INTEGER,
    mean REAL,
    highest REAL,
    lowest REAL,
    pass_count INTEGER,
    pass_rate REAL,
    UNIQUE(exam_id, subject_id)
  );
  CREATE TABLE IF NOT EXISTS grading_scales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS grading_boundaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scale_id INTEGER REFERENCES grading_scales(id) ON DELETE CASCADE,
    grade TEXT NOT NULL,
    min_marks REAL,
    max_marks REAL,
    points REAL,
    division TEXT
  );
  -- Richer Student Profile — POINT 1
  CREATE TABLE IF NOT EXISTS student_guardians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    occupation TEXT,
    address TEXT,
    is_primary INTEGER DEFAULT 0,
    is_emergency INTEGER DEFAULT 0,
    can_pickup INTEGER DEFAULT 1,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS student_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    doc_type TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    expiry_date TEXT,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS student_siblings (
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    sibling_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, sibling_id)
  );
  CREATE TABLE IF NOT EXISTS houses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    colour TEXT,
    motto TEXT
  );
  CREATE TABLE IF NOT EXISTS streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INTEGER,
    class_teacher_id INTEGER REFERENCES users(id),
    UNIQUE(class_id, name)
  );
  CREATE TABLE IF NOT EXISTS student_placements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id),
    stream_id INTEGER REFERENCES streams(id),
    house_id INTEGER REFERENCES houses(id),
    academic_year TEXT,
    term TEXT,
    is_current INTEGER DEFAULT 1,
    promoted_from INTEGER REFERENCES student_placements(id),
    promotion_type TEXT,
    notes TEXT,
    start_date TEXT,
    end_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  `);
  // Migrate students — add richer columns (safe, ignore if exists)
  const _cols=[['date_of_birth','TEXT'],['academic_year','TEXT'],['term','TEXT'],['middle_name','TEXT'],['preferred_name','TEXT'],['place_of_birth','TEXT'],['nationality','TEXT'],['religion','TEXT'],['blood_group','TEXT'],['home_language','TEXT'],['address_line1','TEXT'],['address_line2','TEXT'],['city','TEXT'],['district','TEXT'],['country','TEXT DEFAULT \'Uganda\''],['status_reason','TEXT'],['status_changed_at','TEXT'],['previous_school','TEXT'],['previous_class','TEXT'],['transfer_reason','TEXT'],['special_needs','TEXT'],['allergies','TEXT'],['medical_notes','TEXT'],['photo_url','TEXT'],['updated_at','TEXT'],['created_by','INTEGER'],['updated_by','INTEGER'],['deleted_at','TEXT']];
  _cols.forEach(([c,t])=>{ try{ db.exec(`ALTER TABLE students ADD COLUMN ${c} ${t}`); }catch(e){} });
  // Migrate classes
  [['level_order','INTEGER'],['is_active','INTEGER DEFAULT 1']].forEach(([c,t])=>{ try{ db.exec(`ALTER TABLE classes ADD COLUMN ${c} ${t}`); }catch(e){} });
  // Migrate exams — production-grade Exams & Results module
  [['exam_type','TEXT'],['class_id','INTEGER'],['stream_id','INTEGER'],['max_marks','REAL DEFAULT 100'],['pass_mark','REAL DEFAULT 40'],['weight_percent','REAL'],['status','TEXT DEFAULT \'Draft\''],['created_by','INTEGER'],['updated_at','TEXT']].forEach(([c,t])=>{ try{ db.exec(`ALTER TABLE exams ADD COLUMN ${c} ${t}`); }catch(e){} });
  try{ db.exec("UPDATE exams SET status='Open' WHERE (status IS NULL OR status='') AND id IN (SELECT DISTINCT exam_id FROM results)"); }catch(e){}
  try{ db.exec("UPDATE exams SET status='Draft' WHERE status IS NULL OR status=''"); }catch(e){}
  // Backfill level_order
  try{
    const order={'Baby Class':0,'Middle Class':1,'Top Class':2,'P1':3,'P2':4,'P3':5,'P4':6,'P5':7,'P6':8,'P7':9,'S1':10,'S2':11,'S3':12,'S4':13,'S5':14,'S6':15};
    Object.entries(order).forEach(([n,o])=> db.prepare('UPDATE classes SET level_order=? WHERE name=?').run(o,n));
  }catch(e){}
  // Seed houses if empty
  try{
    if(db.prepare('SELECT COUNT(*) as n FROM houses').get().n===0){
      [['Blue','blue','Knowledge'],['Red','red','Courage'],['Green','green','Growth'],['Yellow','yellow','Light']].forEach(([n,c,m])=> db.prepare('INSERT INTO houses (name,colour,motto) VALUES (?,?,?)').run(n,c,m));
    }
  }catch(e){}
  // Seed streams for each class if empty
  try{
    if(db.prepare('SELECT COUNT(*) as n FROM streams').get().n===0){
      const cls=db.prepare('SELECT id, name FROM classes').all();
      cls.forEach(cl=>{ ['A','B'].forEach(s=> { try{ db.prepare('INSERT OR IGNORE INTO streams (class_id,name,capacity) VALUES (?,?,?)').run(cl.id,s,40); }catch(e){} }); });
    }
  }catch(e){}
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
  // Seed grading scales if empty (Primary default + UCE secondary)
  try{
    if(db.prepare('SELECT COUNT(*) as n FROM grading_scales').get().n===0){
      const prim=require('./grading_scales_seed');
      db.prepare('INSERT INTO grading_scales (name,is_default) VALUES (?,?)').run('Primary Scale',1);
      db.prepare('INSERT INTO grading_scales (name,is_default) VALUES (?,?)').run('Secondary Scale (UCE)',0);
      const pid=db.prepare('SELECT id FROM grading_scales WHERE name=?').get('Primary Scale').id;
      const sid=db.prepare('SELECT id FROM grading_scales WHERE name=?').get('Secondary Scale (UCE)').id;
      const ins=db.prepare('INSERT INTO grading_boundaries (scale_id,grade,min_marks,max_marks,points,division) VALUES (?,?,?,?,?,?)');
      for(const b of prim){ ins.run(pid,b.grade,b.min,b.max,b.points,b.division); ins.run(sid,b.grade,b.min,b.max,b.points,b.division); }
    }
  }catch(e){ console.log('grading scale seed', e.message); }
  // ensure class_teacher & subject_teacher demo users
  try{
    const bcrypt=require('bcryptjs');
    const add=(u,p,r,nm)=>{ if(!db.prepare('SELECT id FROM users WHERE username=?').get(u)){ const h=bcrypt.hashSync(p,10); db.prepare('INSERT INTO users (username,password,role,name,email) VALUES (?,?,?,?,?)').run(u,h,r,nm,u+'@school.local'); console.log('Created '+u+' / '+p); } };
    add('classteacher','class123','class_teacher','Ms. Nalwoga (Class Teacher)');
    add('subjectteacher','subject123','subject_teacher','Mr. Tumusiime (Subject Teacher)');
    add('dos','dos123','dos','Director of Studies');
    add('nm','123456','teacher','NM User');
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
  try{ db.exec(`ALTER TABLE maintenance ADD COLUMN token_valid_since INTEGER DEFAULT 0`); }catch(e){}
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
  // Ensure streams now that classes exist (seed A/B per class if streams empty)
  try{
    if(db.prepare('SELECT COUNT(*) as n FROM streams').get().n===0){
      const cls=db.prepare('SELECT id, name FROM classes').all();
      cls.forEach(cl=>{ ['A','B'].forEach(s=> { try{ db.prepare('INSERT OR IGNORE INTO streams (class_id,name,capacity) VALUES (?,?,?)').run(cl.id,s,40); }catch(e){} }); });
      console.log('Seeded A/B streams for', cls.length, 'classes');
    }
  }catch(e){ console.log('streams seed', e.message); }
}
init();
module.exports = db;
