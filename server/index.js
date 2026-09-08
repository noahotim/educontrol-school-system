const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const db = require('./db');
const { sign, verify, verifyWithKey, role, BACKUP_KEY } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true}));
const multer=require('multer');
const uploadDir=path.join(__dirname,'../public/uploads');
fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,uploadDir), filename:(req,file,cb)=>{ const ext=path.extname(file.originalname)||'.jpg'; cb(null, Date.now()+'_'+Math.random().toString(36).slice(2,6)+ext); }});
const upload=multer({storage, limits:{fileSize:2*1024*1024}, fileFilter:(req,file,cb)=>{ if(!file.mimetype.startsWith('image/')) return cb(new Error('Only images')); cb(null,null); }});
app.use('/uploads', express.static(uploadDir));
app.post('/api/upload/photo', verify, authorize('students','staff','*'), upload.single('photo'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'No file'});
  const url=`/uploads/${req.file.filename}`;
  // optionally update student/staff if ids provided
  if(req.body.student_id){ try{ db.prepare('UPDATE students SET photo=? WHERE id=?').run(url, req.body.student_id); }catch(e){} }
  if(req.body.staff_id){ try{ db.prepare('UPDATE staff SET photo=? WHERE id=?').run(url, req.body.staff_id); }catch(e){} }
  res.json({url, filename:req.file.filename});
});

// Maintenance kill switch — blocks non-admin when enabled
function maintenanceGuard(req,res,next){
  try{
    const m=db.prepare('SELECT * FROM maintenance WHERE id=1').get();
    if(m && m.enabled){
      // allow admin, allow login, allow maintenance status, allow backup with key
      const isLogin = req.path==='/api/login';
      const isMaintenanceGet = req.path==='/api/maintenance';
      const isBackupKey = req.path==='/api/backup' && req.query.key;
      if(isLogin || isMaintenanceGet || isBackupKey) return next();
      // verify token if present to check admin
      let isAdmin=false;
      const h=req.headers.authorization;
      let tok=null;
      if(h) tok=h.replace('Bearer ',''); else if(req.query && req.query.token) tok=req.query.token;
      if(tok){ try{ const {SECRET}=require('./auth'); const jwt=require('jsonwebtoken'); const u=jwt.verify(tok, SECRET); if(u.role==='admin') isAdmin=true; }catch(e){} }
      if(isAdmin) return next();
      return res.status(503).json({maintenance:true, message: m.message || 'System under maintenance', enabled_at: m.enabled_at, enabled_by: m.enabled_by});
    }
  }catch(e){}
  next();
}
app.use(maintenanceGuard);

// Auth routes
app.post('/api/login', (req,res)=>{
  const {username,password} = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if(!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({error:'Invalid credentials'});
  const token = sign(user);
  res.json({token, user:{id:user.id, username:user.username, role:user.role, name:user.name, email:user.email}});
});
app.post('/api/register', verify, (req,res)=>{
  const {username,password,role,name,email} = req.body;
  if(!username||!password) return res.status(400).json({error:'username & password required'});
  const hash = bcrypt.hashSync(password,10);
  try{
    const r = db.prepare('INSERT INTO users (username,password,role,name,email) VALUES (?,?,?,?,?)').run(username,hash, role||'teacher', name||username, email||'');
    res.json({id:r.lastInsertRowid});
  }catch(e){ res.status(400).json({error:e.message});}
});
app.get('/api/me', verify, (req,res)=> res.json(req.user));
app.get('/api/users', verify, role('admin','headteacher'), (req,res)=> res.json(db.prepare('SELECT id,username,role,name,email,created_at FROM users').all()));

// RBAC — who can do what — class_teacher compiles, subject_teacher enters marks (auto-routed)
const RBAC = {
  admin: ['*'],
  headteacher: ['dashboard','students','attendance','classes','exams','reportcards','aitutor','staff:read','payroll:read','fees:read','expenses:read','reports:read','procurement','inventory','sickbay:read','transport','events','sms','backup:read'],
  teacher: ['dashboard','students','attendance','classes:read','exams','reportcards','aitutor','staff:read','events:read','transport:read'],
  class_teacher: ['dashboard','students','attendance','classes','exams:read','reportcards','exams:compile','classes:promote','aitutor','staff:read','events:read','transport:read'],
  subject_teacher: ['dashboard','students:read','exams:enter','aitutor:read','events:read'],
  bursar: ['dashboard','students:read','staff:read','fees','expenses','reports','payroll','procurement','inventory','events:read','sms'],
  nurse: ['dashboard','students:read','sickbay','events:read','aitutor:read'],
};
function can(role, perm){
  if(!role) return false;
  const perms = RBAC[role] || [];
  if(perms.includes('*')) return true;
  if(perms.includes(perm)) return true;
  const base = perm.split(':')[0];
  if(perms.includes(base)) return true;
  return false;
}
function authorize(...perms){
  return (req,res,next)=>{
    for(const perm of perms){
      if(can(req.user.role, perm)) return next();
    }
    return res.status(403).json({error:`Forbidden — ${req.user.role} cannot access ${perms.join(' or ')}. Allowed: ${(RBAC[req.user.role]||[]).join(', ')}`});
  };
}
app.get('/api/roles', verify, (req,res)=> res.json({roles: RBAC, me: req.user.role}));

// Teacher assignments — admin/headteacher assigns, teachers auto-routed
app.get('/api/teacher-assignments', verify, authorize('staff','staff:read'), (req,res)=>{
  const rows=db.prepare('SELECT ta.*, u.username, u.name, u.role FROM teacher_assignments ta JOIN users u ON u.id=ta.user_id ORDER BY u.username').all();
  res.json(rows);
});
app.post('/api/teacher-assignments', verify, authorize('staff'), (req,res)=>{
  const {user_id, subject, class:cls}=req.body;
  if(!user_id||!subject||!cls) return res.status(400).json({error:'user_id, subject, class required'});
  try{ const r=db.prepare('INSERT OR IGNORE INTO teacher_assignments (user_id,subject,class) VALUES (?,?,?)').run(user_id,subject,cls); res.json({id:r.lastInsertRowid}); }catch(e){ res.status(400).json({error:e.message}); }
});
app.delete('/api/teacher-assignments/:id', verify, authorize('staff'), (req,res)=>{ db.prepare('DELETE FROM teacher_assignments WHERE id=?').run(req.params.id); res.json({ok:true}); });
app.get('/api/my-assignments', verify, (req,res)=>{
  const rows=db.prepare('SELECT * FROM teacher_assignments WHERE user_id=?').all(req.user.id);
  res.json(rows);
});
// Compile results — class_teacher one-click (auto aggregates all subjects)
app.post('/api/results/compile/:examId', verify, authorize('exams:compile','exams','*'), (req,res)=>{
  const examId=req.params.examId;
  const exam=db.prepare('SELECT * FROM exams WHERE id=?').get(examId);
  if(!exam) return res.status(404).json({error:'Exam not found'});
  const results=db.prepare('SELECT r.*, s.first_name, s.last_name, s.class FROM results r JOIN students s ON s.id=r.student_id WHERE r.exam_id=?').all(examId);
  if(!results.length) return res.status(400).json({error:'No marks entered yet — subject teachers must enter marks first'});
  // group by student
  const byStudent={};
  for(const r of results){
    if(!byStudent[r.student_id]) byStudent[r.student_id]={student_id:r.student_id, name:r.first_name+' '+r.last_name, class:r.class, marks:[]};
    byStudent[r.student_id].marks.push(r.marks);
  }
  const compiled=[];
  for(const sid in byStudent){
    const m=byStudent[sid].marks;
    const total=m.reduce((a,b)=>a+Number(b),0);
    const avg=total/m.length;
    let agg=0; for(const mk of m){ const mm=Number(mk); if(mm>=80) agg+=1; else if(mm>=70) agg+=2; else if(mm>=60) agg+=3; else if(mm>=50) agg+=4; else if(mm>=40) agg+=5; else if(mm>=35) agg+=6; else if(mm>=28) agg+=7; else if(mm>=20) agg+=8; else agg+=9; }
    let div='U'; if(avg>=80) div='I'; else if(avg>=60) div='II'; else if(avg>=50) div='III'; else if(avg>=40) div='IV';
    compiled.push({student_id:sid, total, average: Number(avg.toFixed(1)), aggregate:agg, division:div});
  }
  compiled.sort((a,b)=> a.aggregate - b.aggregate || b.average - a.average);
  compiled.forEach((c,i)=> c.position=i+1);
  const ins=db.prepare('INSERT OR REPLACE INTO compiled_results (exam_id, student_id, total, average, aggregate, division, position) VALUES (?,?,?,?,?,?,?)');
  const tx=db.transaction(()=>{ for(const c of compiled) ins.run(examId,c.student_id,c.total,c.average,c.aggregate,c.division,c.position); });
  tx();
  res.json({compiled: compiled.length, exam: exam.name, top: compiled.slice(0,3), note: 'Auto-compiled — report cards & positions ready. Class teacher just clicked Compile.'});
});
app.get('/api/results/compiled/:examId', verify, authorize('exams:read','exams:compile','*'), (req,res)=>{
  const rows=db.prepare('SELECT c.*, s.first_name, s.last_name, s.admission_no, s.class FROM compiled_results c JOIN students s ON s.id=c.student_id WHERE c.exam_id=? ORDER BY c.position').all(req.params.examId);
  res.json(rows);
});

// Helper to create CRUD with optional perm
function crud(table, permBase){
  if(!permBase) permBase = table;
  const router = express.Router();
  const pRead = permBase.includes(':') ? permBase : permBase+':read';
  const pWrite = permBase.includes(':') ? permBase.split(':')[0] : permBase;
  router.get('/', verify, authorize(pRead), (req,res)=>{
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
    res.json(rows);
  });
  router.get('/:id', verify, authorize(pRead), (req,res)=>{
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id);
    if(!row) return res.status(404).json({error:'Not found'});
    res.json(row);
  });
  router.post('/', verify, authorize(pWrite), (req,res)=>{
    const data = req.body;
    const keys = Object.keys(data).filter(k=> data[k]!==undefined);
    if(keys.length===0) return res.status(400).json({error:'No data'});
    const cols = keys.join(',');
    const placeholders = keys.map(_=>'?').join(',');
    try{
      const stmt = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`);
      const r = stmt.run(...keys.map(k=> typeof data[k]==='object'? JSON.stringify(data[k]): data[k]));
      res.json({id:r.lastInsertRowid});
    }catch(e){ res.status(400).json({error:e.message});}
  });
  router.put('/:id', verify, authorize(pWrite), (req,res)=>{
    const data = req.body;
    const keys = Object.keys(data).filter(k=> k!=='id');
    if(keys.length===0) return res.json({ok:true});
    const set = keys.map(k=> `${k}=?`).join(',');
    try{
      db.prepare(`UPDATE ${table} SET ${set} WHERE id=?`).run(...keys.map(k=> typeof data[k]==='object'? JSON.stringify(data[k]): data[k]), req.params.id);
      res.json({ok:true});
    }catch(e){ res.status(400).json({error:e.message});}
  });
  router.delete('/:id', verify, authorize(pWrite), (req,res)=>{
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.json({ok:true});
  });
  return router;
}

// Custom students routes with search — RBAC
app.get('/api/students', verify, authorize('students:read'), (req,res)=>{
  const q = req.query.q;
  let rows;
  if(q) rows = db.prepare(`SELECT * FROM students WHERE first_name LIKE ? OR last_name LIKE ? OR admission_no LIKE ? OR class LIKE ? ORDER BY id DESC`).all(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`);
  else rows = db.prepare('SELECT * FROM students ORDER BY id DESC').all();
  res.json(rows);
});
app.post('/api/students', verify, authorize('students'), (req,res)=>{
  const d=req.body;
  if(!d.admission_no) d.admission_no = 'ADM'+Date.now().toString().slice(-6);
  if(!d.admission_date) d.admission_date = dayjs().format('YYYY-MM-DD');
  const keys=Object.keys(d);
  try{
    const r=db.prepare(`INSERT INTO students (${keys.join(',')}) VALUES (${keys.map(_=>'?').join(',')})`).run(...keys.map(k=> d[k]));
    res.json({id:r.lastInsertRowid});
  }catch(e){ res.status(400).json({error:e.message});}
});
app.put('/api/students/:id', verify, authorize('students'), (req,res)=>{
  const d=req.body; const keys=Object.keys(d).filter(k=>k!=='id');
  const set=keys.map(k=> `${k}=?`).join(',');
  try{ db.prepare(`UPDATE students SET ${set} WHERE id=?`).run(...keys.map(k=> d[k]), req.params.id); res.json({ok:true});}catch(e){res.status(400).json({error:e.message});}
});
app.delete('/api/students/:id', verify, authorize('students'), (req,res)=>{ db.prepare('DELETE FROM students WHERE id=?').run(req.params.id); res.json({ok:true}); });
app.get('/api/students/:id', verify, authorize('students:read'), (req,res)=>{ const r=db.prepare('SELECT * FROM students WHERE id=?').get(req.params.id); if(!r) return res.status(404).json({error:'Not found'}); res.json(r);});

// Attendance bulk
app.post('/api/attendance/bulk', verify, authorize('attendance'), (req,res)=>{
  const {date, records} = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO attendance (student_id,date,status) VALUES (?,?,?)');
  const tx=db.transaction((recs)=>{ for(const r of recs) stmt.run(r.student_id, date, r.status); });
  try{ tx(records); res.json({ok:true}); }catch(e){ res.status(400).json({error:e.message});}
});
app.get('/api/attendance', verify, authorize('attendance:read'), (req,res)=>{
  const {date, class:cls} = req.query;
  let q = 'SELECT a.*, s.first_name, s.last_name, s.class, s.admission_no FROM attendance a JOIN students s ON s.id=a.student_id';
  const params=[]; const where=[];
  if(date){ where.push('a.date=?'); params.push(date); }
  if(cls){ where.push('s.class=?'); params.push(cls); }
  if(where.length) q+=' WHERE '+where.join(' AND ');
  q+=' ORDER BY a.date DESC';
  res.json(db.prepare(q).all(...params));
});

// Results — allow academic + AI tutor + dashboard for analytics
app.get('/api/results', verify, authorize('exams:read','aitutor:read','dashboard:read','students:read'), (req,res)=>{
  const {exam_id, student_id} = req.query;
  let q='SELECT r.*, s.first_name, s.last_name, s.class FROM results r JOIN students s ON s.id=r.student_id WHERE 1=1';
  const p=[];
  if(exam_id){ q+=' AND r.exam_id=?'; p.push(exam_id);}
  if(student_id){ q+=' AND r.student_id=?'; p.push(student_id);}
  res.json(db.prepare(q).all(...p));
});
app.post('/api/results/bulk', verify, authorize('exams','exams:enter'), (req,res)=>{
  const {exam_id, subject, entries} = req.body;
  // Auto-routing: subject teachers can only enter for their assigned subject/class
  if(req.user.role==='subject_teacher'){
    const assigns=db.prepare('SELECT * FROM teacher_assignments WHERE user_id=?').all(req.user.id);
    const allowedSubs=new Set(assigns.map(a=>a.subject));
    const allowedClasses=new Set(assigns.map(a=>a.class));
    if(!allowedSubs.has(subject) && !allowedSubs.has('ALL')){
      return res.status(403).json({error:`You are not assigned to ${subject}. Your subjects: ${[...allowedSubs].join(', ')||'none'}. Ask admin to assign.`});
    }
    // verify each student's class is allowed
    for(const e of entries){
      const st=db.prepare('SELECT class FROM students WHERE id=?').get(e.student_id);
      if(!st) continue;
      if(!allowedClasses.has(st.class) && !allowedClasses.has('ALL') && ![...allowedClasses].some(c=>c===st.class)){
        return res.status(403).json({error:`You are not assigned to class ${st.class} for ${subject}. Your classes: ${[...allowedClasses].join(', ')}`});
      }
    }
  }
  const stmt=db.prepare('INSERT OR REPLACE INTO results (exam_id, student_id, subject, marks, grade) VALUES (?,?,?,?,?)');
  function grade(m){ if(m>=80) return 'D1'; if(m>=70) return 'D2'; if(m>=60) return 'C3'; if(m>=50) return 'C4'; if(m>=40) return 'C5'; if(m>=35) return 'C6'; if(m>=28) return 'P7'; if(m>=20) return 'P8'; return 'F9';}
  const tx=db.transaction((en)=>{ for(const e of en) stmt.run(exam_id, e.student_id, subject, e.marks, grade(e.marks)); });
  try{ tx(entries); res.json({ok:true, routed: `Auto-routed ${entries.length} marks for ${subject} to exam ${exam_id}`}); }catch(e){ res.status(400).json({error:e.message});}
});

// Payroll generate
app.post('/api/payroll/generate', verify, authorize('payroll'), (req,res)=>{
  const {month} = req.body;
  const staff = db.prepare('SELECT * FROM staff').all();
  const stmt=db.prepare('INSERT OR REPLACE INTO payroll (staff_id, month, basic, allowances, deductions, net) VALUES (?,?,?,?,?,?)');
  const tx=db.transaction(()=>{ for(const s of staff){ const basic=s.salary||0; const allowances=Math.round(basic*0.1); const deductions=Math.round(basic*0.05); const net=basic+allowances-deductions; stmt.run(s.id, month, basic, allowances, deductions, net); } });
  tx(); res.json({ok:true, count: staff.length});
});

// Finance overview
app.get('/api/finance/summary', verify, authorize('reports:read'), (req,res)=>{
  const totalFees = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM payments').get().s;
  const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM expenses').get().s;
  const totalIncome = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM incomes').get().s;
  const balance = (totalFees+totalIncome) - totalExpenses;
  res.json({totalFees, totalExpenses, totalIncome, balance});
});
// Fee Defaulters — easiest mechanism to filter and get parents
app.get('/api/fees/defaulters', verify, authorize('fees:read'), (req,res)=>{
  const {term, class:cls} = req.query;
  const targetTerm = term || 'Term I';
  // Get all students (filtered by class if needed)
  let students;
  if(cls) students = db.prepare('SELECT * FROM students WHERE class=? ORDER BY class, first_name').all(cls);
  else students = db.prepare('SELECT * FROM students ORDER BY class, first_name').all();
  const defaulters=[];
  for(const s of students){
    // Find fees for this student's class+term
    const fee = db.prepare('SELECT * FROM fees_structure WHERE class=? AND term=?').get(s.class, targetTerm)
             || db.prepare('SELECT * FROM fees_structure WHERE term=? LIMIT 1').get(targetTerm);
    const due = fee ? fee.amount : 0;
    if(due===0) continue; // no fee setup, skip
    const paidRow = db.prepare('SELECT COALESCE(SUM(amount),0) as sum FROM payments WHERE student_id=? AND term=?').get(s.id, targetTerm);
    const paid = paidRow.sum || 0;
    const balance = due - paid;
    if(balance > 0){
      defaulters.push({
        student_id: s.id, admission_no: s.admission_no, first_name: s.first_name, last_name: s.last_name,
        class: s.class, parent_name: s.parent_name, parent_phone: s.parent_phone, parent_email: s.parent_email,
        due, paid, balance, term: targetTerm, status: paid===0?'Not Paid': balance>due*0.5?'Partial (Owes >50%)':'Partial'
      });
    }
  }
  // Sort by balance owed descending
  defaulters.sort((a,b)=> b.balance - a.balance);
  res.json({term: targetTerm, class: cls||'All', count: defaulters.length, totalOwed: defaulters.reduce((a,b)=>a+b.balance,0), defaulters});
});
app.get('/api/fees/parents-for-defaulters', verify, authorize('fees:read'), (req,res)=>{
  const {term, class:cls} = req.query;
  const data = db.prepare('SELECT * FROM students').all(); // fallback to reuse defaulters logic
  // Reuse same logic but return unique parents
  const targetTerm = term || 'Term I';
  let students;
  if(cls) students = db.prepare('SELECT * FROM students WHERE class=?').all(cls);
  else students = db.prepare('SELECT * FROM students').all();
  const parentsMap={};
  for(const s of students){
    const fee = db.prepare('SELECT * FROM fees_structure WHERE class=? AND term=?').get(s.class, targetTerm) || db.prepare('SELECT * FROM fees_structure WHERE term=? LIMIT 1').get(targetTerm);
    const due = fee ? fee.amount : 0;
    if(due===0) continue;
    const paid = db.prepare('SELECT COALESCE(SUM(amount),0) as sum FROM payments WHERE student_id=? AND term=?').get(s.id, targetTerm).sum || 0;
    if(due - paid > 0 && s.parent_phone){
      const key=s.parent_phone;
      if(!parentsMap[key]) parentsMap[key]={phone:s.parent_phone, name:s.parent_name||'Parent', children:[], totalOwed:0};
      parentsMap[key].children.push({admission_no:s.admission_no, name:s.first_name+' '+s.last_name, class:s.class, balance: due - paid});
      parentsMap[key].totalOwed += (due - paid);
    }
  }
  const parents = Object.values(parentsMap).sort((a,b)=> b.totalOwed - a.totalOwed);
  res.json({term: targetTerm, class: cls||'All', parents, count: parents.length});
});

// Dashboard stats
app.get('/api/dashboard', verify, authorize('dashboard:read'), (req,res)=>{
  const students = db.prepare('SELECT COUNT(*) as n FROM students').get().n;
  const staff = db.prepare('SELECT COUNT(*) as n FROM staff').get().n;
  const fees = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM payments').get().s;
  const expenses = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM expenses').get().s;
  const attendanceToday = db.prepare("SELECT COUNT(*) as n FROM attendance WHERE date=date('now') AND status='Present'").get().n;
  const lowStock = db.prepare('SELECT COUNT(*) as n FROM inventory WHERE quantity <= low_stock').get().n;
  const sickVisits = db.prepare("SELECT COUNT(*) as n FROM medical_records WHERE visit_date=date('now')").get().n;
  const events = db.prepare("SELECT COUNT(*) as n FROM events WHERE date(start_date) >= date('now')").get().n;
  const transport = db.prepare('SELECT COUNT(*) as n FROM transport_reg').get().n;
  // charts data
  const feesByMonth = db.prepare("SELECT substr(date,1,7) as m, SUM(amount) as total FROM payments GROUP BY m ORDER BY m LIMIT 6").all();
  const studentsByClass = db.prepare('SELECT class, COUNT(*) as count FROM students GROUP BY class').all();
  const expensesByCat = db.prepare('SELECT category, SUM(amount) as total FROM expenses GROUP BY category').all();
  const attendanceTrend = db.prepare("SELECT date, COUNT(*) as present FROM attendance WHERE status='Present' GROUP BY date ORDER BY date DESC LIMIT 7").all().reverse();
  res.json({students, staff, fees, expenses, attendanceToday, lowStock, sickVisits, events, transport, feesByMonth, studentsByClass, expensesByCat, attendanceTrend});
});

// Promotion
app.post('/api/promote', verify, authorize('classes'), (req,res)=>{
  const {from_class, to_class, year} = req.body;
  const students = db.prepare('SELECT * FROM students WHERE class=?').all(from_class);
  const upd = db.prepare('UPDATE students SET class=? WHERE id=?');
  const ins = db.prepare('INSERT INTO promotions (student_id, from_class, to_class, year, date) VALUES (?,?,?,?,?)');
  const tx=db.transaction(()=>{ for(const s of students){ upd.run(to_class, s.id); ins.run(s.id, from_class, to_class, year, dayjs().format('YYYY-MM-DD')); } });
  tx(); res.json({promoted: students.length});
});

// AI Tutor - simple rule based
app.post('/api/ai-tutor', verify, authorize('aitutor:read'), (req,res)=>{
  const {question, student_id} = req.body;
  // get student results for personalization
  let context='';
  if(student_id){
    const results = db.prepare('SELECT subject, AVG(marks) as avg FROM results WHERE student_id=? GROUP BY subject').all(student_id);
    if(results.length) context = 'Student averages: '+ results.map(r=> `${r.subject}:${Math.round(r.avg)}%`).join(', ') + '. ';
  }
  const q = (question||'').toLowerCase();
  let answer='';
  if(q.includes('math')||q.includes('algebra')||q.includes('equation')){
    answer = context + "For mathematics: Break problems into steps. Example: Solve 2x+3=11 → 2x=8 → x=4. Practice BODMAS, fractions, and word problems daily. Would you like a 5-question quiz?";
  } else if(q.includes('science')||q.includes('biology')||q.includes('physics')||q.includes('chemistry')){
    answer = context + "Science tip: Use concept maps. For Biology - remember cell parts with mnemonic, for Physics - practice formulas (F=ma, V=IR). Ask me for diagrams or definitions!";
  } else if(q.includes('english')||q.includes('grammar')||q.includes('essay')){
    answer = context + "English tip: For essays, use PEEL structure (Point, Evidence, Explain, Link). For grammar, master tenses and parts of speech. Share your essay for feedback!";
  } else if(q.includes('exam')||q.includes('revision')||q.includes('study')){
    answer = context + "Create a revision timetable: 45min study + 15min break (Pomodoro). Prioritize weak subjects first. Past papers + marking schemes are gold. Need a personalized timetable?";
  } else{
    answer = context + `Great question: "${question}". I'm your AI Tutor! I can help with Mathematics, Science, English, SST, exam revision, and career guidance. Ask e.g., "Explain photosynthesis", "Help me with fractions", or "Make a study plan for P7".`;
  }
  res.json({answer, context});
});

// SMS mock
app.post('/api/sms/send', verify, authorize('sms'), (req,res)=>{
  const {recipients, message, type} = req.body; // recipients [{phone,name}]
  const stmt=db.prepare('INSERT INTO sms_logs (recipient, phone, message, type) VALUES (?,?,?,?)');
  const tx=db.transaction(()=>{
    for(const r of recipients) stmt.run(r.name||r.phone, r.phone, message, type||'General');
  });
  tx();
  res.json({sent: recipients.length, note:'SMS queued (mock - integrate SMS gateway in production)'});
});
// Bulk Results to Parents — easiest one-click
app.post('/api/sms/send-bulk-results', verify, authorize('exams','sms'), (req,res)=>{
  const {exam_id, customMessage} = req.body;
  if(!exam_id) return res.status(400).json({error:'exam_id required'});
  const exam = db.prepare('SELECT * FROM exams WHERE id=?').get(exam_id);
  if(!exam) return res.status(404).json({error:'Exam not found'});
  const results = db.prepare('SELECT r.*, s.first_name, s.last_name, s.class, s.parent_name, s.parent_phone, s.admission_no FROM results r JOIN students s ON s.id=r.student_id WHERE r.exam_id=? ORDER BY s.class, s.first_name').all(exam_id);
  if(!results.length) return res.status(400).json({error:'No results for this exam yet'});
  // Group by student
  const byStudent={};
  for(const r of results){
    const key=r.student_id;
    if(!byStudent[key]) byStudent[key]={student_id: r.student_id, admission_no: r.admission_no, name: r.first_name+' '+r.last_name, class: r.class, parent_name: r.parent_name, parent_phone: r.parent_phone, subjects:[]};
    byStudent[key].subjects.push({subject:r.subject, marks:r.marks, grade:r.grade});
  }
  const students=Object.values(byStudent);
  const stmt=db.prepare('INSERT INTO sms_logs (recipient, phone, message, type) VALUES (?,?,?,?)');
  let sent=0;
  const tx=db.transaction(()=>{
    for(const st of students){
      if(!st.parent_phone) continue;
      const avg = (st.subjects.reduce((a,b)=>a+Number(b.marks),0)/st.subjects.length).toFixed(1);
      const summary = st.subjects.map(s=> `${s.subject}:${s.marks}(${s.grade})`).join(', ');
      const msg = customMessage ? customMessage.replace('{name}', st.name).replace('{class}', st.class).replace('{exam}', exam.name).replace('{results}', summary).replace('{avg}', avg)
        : `Dear ${st.parent_name||'Parent'}, ${st.name} (${st.class}, ${st.admission_no}) results for ${exam.name} ${exam.term} ${exam.year}: ${summary}. Average: ${avg}%. - EduControl Academy`;
      stmt.run(st.parent_name||st.name, st.parent_phone, msg, 'Results');
      sent++;
    }
  });
  tx();
  res.json({sent, total: students.length, exam: exam.name, note: `Bulk results SMS queued for ${sent} parents (of ${students.length} students with results). Integrate Africa's Talking/Twilio for real delivery.`});
});
app.get('/api/sms/preview-bulk-results', verify, authorize('exams','sms','exams:read'), (req,res)=>{
  const {exam_id} = req.query;
  if(!exam_id) return res.status(400).json({error:'exam_id required'});
  const exam = db.prepare('SELECT * FROM exams WHERE id=?').get(exam_id);
  const results = db.prepare('SELECT r.*, s.first_name, s.last_name, s.class, s.parent_name, s.parent_phone, s.admission_no FROM results r JOIN students s ON s.id=r.student_id WHERE r.exam_id=? LIMIT 5').all(exam_id);
  const byStudent={};
  for(const r of results){
    const k=r.student_id;
    if(!byStudent[k]) byStudent[k]={name:r.first_name+' '+r.last_name, class:r.class, parent_phone:r.parent_phone, subjects:[]};
    byStudent[k].subjects.push(`${r.subject}:${r.marks}(${r.grade})`);
  }
  const preview = Object.values(byStudent).map(s=> `Dear Parent, ${s.name} (${s.class}) results: ${s.subjects.join(', ')} - EduControl`).slice(0,3);
  res.json({exam: exam?exam.name:'', count: Object.keys(byStudent).length, preview});
});

// Maintenance API — admin kill switch
app.get('/api/maintenance', (req,res)=>{
  const m=db.prepare('SELECT * FROM maintenance WHERE id=1').get();
  res.json({enabled: !!(m&&m.enabled), message: m?m.message:'', enabled_at: m?m.enabled_at:'', enabled_by: m?m.enabled_by:''});
});
app.post('/api/maintenance/toggle', verify, authorize('*'), (req,res)=>{
  if(req.user.role!=='admin') return res.status(403).json({error:'Only admin can toggle maintenance'});
  const {enabled, message}=req.body;
  const msg=message||'System under maintenance — please try again later';
  db.prepare('UPDATE maintenance SET enabled=?, message=?, enabled_by=?, enabled_at=? WHERE id=1').run(enabled?1:0, msg, req.user.username, new Date().toISOString());
  res.json({enabled: !!enabled, message: msg});
});
// Scalable school levels — P1-P7 now, S1-S6 ready (100% secure, upgradable)
app.get('/api/settings/school', (req,res)=>{
  const lvl=db.prepare('SELECT value FROM system_settings WHERE key=?').get('school_level');
  const active=db.prepare('SELECT value FROM system_settings WHERE key=?').get('active_classes');
  const lvlVal=lvl?lvl.value:'primary';
  const activeVal=active?JSON.parse(active.value):['P1','P2','P3','P4','P5','P6','P7'];
  res.json({level: lvlVal, activeClasses: activeVal, allClasses: ['P1','P2','P3','P4','P5','P6','P7','S1','S2','S3','S4','S5','S6'], secure: true, upgradable: true});
});
app.get('/api/settings/active-classes', (req,res)=>{
  const active=db.prepare('SELECT value FROM system_settings WHERE key=?').get('active_classes');
  res.json(active?JSON.parse(active.value):['P1','P2','P3','P4','P5','P6','P7']);
});
app.post('/api/settings/school', verify, authorize('*'), (req,res)=>{
  if(req.user.role!=='admin' && req.user.role!=='headteacher') return res.status(403).json({error:'Only admin/headteacher'});
  const {level, activeClasses}=req.body;
  if(level) db.prepare('INSERT OR REPLACE INTO system_settings (key,value,updated_at) VALUES (?,?,?)').run('school_level', level, new Date().toISOString());
  if(activeClasses) db.prepare('INSERT OR REPLACE INTO system_settings (key,value,updated_at) VALUES (?,?,?)').run('active_classes', JSON.stringify(activeClasses), new Date().toISOString());
  const lvl=db.prepare('SELECT value FROM system_settings WHERE key=?').get('school_level');
  const active=db.prepare('SELECT value FROM system_settings WHERE key=?').get('active_classes');
  res.json({level: lvl.value, activeClasses: JSON.parse(active.value), note: level==='secondary' || (activeClasses&&activeClasses.includes('S1')) ? 'Upgraded to secondary — S1-S6 now active. Promotion P7→S1 enabled.' : 'Primary P1-P7 active. Ready to upgrade to S1-S6 anytime with one click.'});
});

// Auto-seed on first run (Render free has empty DB)
function autoSeed(){
  try{
    const c = db.prepare('SELECT COUNT(*) as n FROM students').get().n;
    if(c===0){
      console.log('Empty DB detected — auto-seeding demo data...');
      require('./seed');
      console.log('Auto-seed done');
    }
  }catch(e){ console.log('autoSeed skip', e.message); }
}
autoSeed();

// Backup - handles WAL mode correctly + permanent key (no expiry)
app.get('/api/backup', verifyWithKey, async (req,res)=>{
  const src = path.join(__dirname,'../data/school.db');
  if(!fs.existsSync(src)) return res.status(404).json({error:'No DB file'});
  const tmp = path.join(__dirname,'../data/backup_tmp.db');
  try{
    // Use VACUUM INTO for consistent backup (includes WAL)
    db.exec(`VACUUM INTO '${tmp.replace(/'/g,"''")}'`);
    res.download(tmp, `backup_${dayjs().format('YYYY-MM-DD')}.db`, (err)=>{
      try{ fs.unlinkSync(tmp); }catch(e){}
    });
  }catch(e){
    // fallback to direct file
    res.download(src, `backup_${dayjs().format('YYYY-MM-DD')}.db`);
  }
});
app.post('/api/restore', verify, (req,res)=>{
  res.json({note:'Restore via uploading DB file to /data/school.db and restart server'});
});
app.get('/api/backup-permanent', (req,res)=>{
  if(req.query.key !== BACKUP_KEY) return res.status(401).json({error:'Invalid permanent key. Use ?key='+BACKUP_KEY});
  const src = path.join(__dirname,'../data/school.db');
  if(!fs.existsSync(src)) return res.status(404).json({error:'No DB file'});
  const tmp = path.join(__dirname,'../data/backup_tmp2.db');
  try{ db.exec(`VACUUM INTO '${tmp.replace(/'/g,"''")}'`); return res.download(tmp, `backup_${dayjs().format('YYYY-MM-DD')}.db`, ()=>{ try{ fs.unlinkSync(tmp);}catch(e){} }); }catch(e){ return res.download(src, `backup_${dayjs().format('YYYY-MM-DD')}.db`); }
});
app.post('/api/seed', verify, (req,res)=>{
  try{ require('./seed'); res.json({ok:true, note:'Seeded demo data (50 students etc.)'}); }catch(e){ res.status(500).json({error:e.message}); }
});

// Other CRUDs — RBAC mapped (table, perm)
app.use('/api/staff', crud('staff','staff'));
app.use('/api/classes', crud('classes','classes'));
app.use('/api/subjects', crud('subjects','exams'));
app.use('/api/exams', crud('exams','exams'));
app.use('/api/fees-structure', crud('fees_structure','fees'));
app.use('/api/payments', crud('payments','fees'));
app.use('/api/expenses', crud('expenses','expenses'));
app.use('/api/incomes', crud('incomes','expenses'));
app.use('/api/suppliers', crud('suppliers','procurement'));
app.use('/api/requisitions', crud('requisitions','procurement'));
app.use('/api/purchase-orders', crud('purchase_orders','procurement'));
app.use('/api/inventory', crud('inventory','inventory'));
app.use('/api/goods-received', crud('goods_received','procurement'));
app.use('/api/medical-records', crud('medical_records','sickbay'));
app.use('/api/medicines', crud('medicines','sickbay'));
app.use('/api/vehicles', crud('vehicles','transport'));
app.use('/api/drivers', crud('drivers','transport'));
app.use('/api/routes', crud('routes','transport'));
app.use('/api/transport-reg', crud('transport_reg','transport'));
app.use('/api/trips', crud('trips','transport'));
app.use('/api/events', crud('events','events'));
app.use('/api/sms-logs', crud('sms_logs','sms'));
app.use('/api/payrolls', crud('payroll','payroll'));

// Reports
app.get('/api/reports/income-statement', verify, authorize('reports:read'), (req,res)=>{
  const {from, to} = req.query;
  let pFilter = ''; let eFilter='';
  const params=[];
  if(from && to){ pFilter = ' WHERE date BETWEEN ? AND ?'; eFilter=pFilter; params.push(from,to); }
  const income = db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments ${pFilter}`).get(...params).s
               + db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM incomes ${pFilter}`).get(...params).s;
  const expense = db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM expenses ${eFilter}`).get(...params).s;
  const gross = income - expense;
  res.json({income, expense, gross, from, to});
});
app.get('/api/reports/balance-sheet', verify, authorize('reports:read'), (req,res)=>{
  const assets = db.prepare('SELECT COALESCE(SUM(quantity*unit_price),0) as s FROM inventory').get().s;
  const cash = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM payments').get().s - db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM expenses').get().s;
  const liabilities = 0;
  res.json({assets: assets+cash, cash, inventory:assets, liabilities, equity: assets+cash - liabilities});
});

// Serve frontend
app.use(express.static(path.join(__dirname,'../public')));
app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'../public/index.html')));

app.listen(PORT, ()=> console.log(`EduControl running on http://localhost:${PORT} | Admin: admin / admin123`));
