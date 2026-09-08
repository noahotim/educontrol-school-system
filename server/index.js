const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const db = require('./db');
const { sign, verify } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true}));

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
app.get('/api/users', verify, (req,res)=> res.json(db.prepare('SELECT id,username,role,name,email,created_at FROM users').all()));

// Helper to create CRUD
function crud(table, opts={}){
  const router = express.Router();
  router.get('/', verify, (req,res)=>{
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
    res.json(rows);
  });
  router.get('/:id', verify, (req,res)=>{
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id);
    if(!row) return res.status(404).json({error:'Not found'});
    res.json(row);
  });
  router.post('/', verify, (req,res)=>{
    const data = req.body;
    // filter empty
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
  router.put('/:id', verify, (req,res)=>{
    const data = req.body;
    const keys = Object.keys(data).filter(k=> k!=='id');
    if(keys.length===0) return res.json({ok:true});
    const set = keys.map(k=> `${k}=?`).join(',');
    try{
      db.prepare(`UPDATE ${table} SET ${set} WHERE id=?`).run(...keys.map(k=> typeof data[k]==='object'? JSON.stringify(data[k]): data[k]), req.params.id);
      res.json({ok:true});
    }catch(e){ res.status(400).json({error:e.message});}
  });
  router.delete('/:id', verify, (req,res)=>{
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.json({ok:true});
  });
  return router;
}

// Custom students routes with search
app.get('/api/students', verify, (req,res)=>{
  const q = req.query.q;
  let rows;
  if(q) rows = db.prepare(`SELECT * FROM students WHERE first_name LIKE ? OR last_name LIKE ? OR admission_no LIKE ? OR class LIKE ? ORDER BY id DESC`).all(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`);
  else rows = db.prepare('SELECT * FROM students ORDER BY id DESC').all();
  res.json(rows);
});
app.post('/api/students', verify, (req,res)=>{
  const d=req.body;
  if(!d.admission_no) d.admission_no = 'ADM'+Date.now().toString().slice(-6);
  if(!d.admission_date) d.admission_date = dayjs().format('YYYY-MM-DD');
  const keys=Object.keys(d);
  try{
    const r=db.prepare(`INSERT INTO students (${keys.join(',')}) VALUES (${keys.map(_=>'?').join(',')})`).run(...keys.map(k=> d[k]));
    res.json({id:r.lastInsertRowid});
  }catch(e){ res.status(400).json({error:e.message});}
});
app.put('/api/students/:id', verify, (req,res)=>{
  const d=req.body; const keys=Object.keys(d).filter(k=>k!=='id');
  const set=keys.map(k=> `${k}=?`).join(',');
  try{ db.prepare(`UPDATE students SET ${set} WHERE id=?`).run(...keys.map(k=> d[k]), req.params.id); res.json({ok:true});}catch(e){res.status(400).json({error:e.message});}
});
app.delete('/api/students/:id', verify, (req,res)=>{ db.prepare('DELETE FROM students WHERE id=?').run(req.params.id); res.json({ok:true}); });
app.get('/api/students/:id', verify, (req,res)=>{ const r=db.prepare('SELECT * FROM students WHERE id=?').get(req.params.id); if(!r) return res.status(404).json({error:'Not found'}); res.json(r);});

// Attendance bulk
app.post('/api/attendance/bulk', verify, (req,res)=>{
  const {date, records} = req.body; // records: [{student_id,status}]
  const stmt = db.prepare('INSERT OR REPLACE INTO attendance (student_id,date,status) VALUES (?,?,?)');
  const tx=db.transaction((recs)=>{ for(const r of recs) stmt.run(r.student_id, date, r.status); });
  try{ tx(records); res.json({ok:true}); }catch(e){ res.status(400).json({error:e.message});}
});
app.get('/api/attendance', verify, (req,res)=>{
  const {date, class:cls} = req.query;
  let q = 'SELECT a.*, s.first_name, s.last_name, s.class, s.admission_no FROM attendance a JOIN students s ON s.id=a.student_id';
  const params=[];
  const where=[];
  if(date){ where.push('a.date=?'); params.push(date); }
  if(cls){ where.push('s.class=?'); params.push(cls); }
  if(where.length) q+=' WHERE '+where.join(' AND ');
  q+=' ORDER BY a.date DESC';
  res.json(db.prepare(q).all(...params));
});

// Results
app.get('/api/results', verify, (req,res)=>{
  const {exam_id, student_id} = req.query;
  let q='SELECT r.*, s.first_name, s.last_name, s.class FROM results r JOIN students s ON s.id=r.student_id WHERE 1=1';
  const p=[];
  if(exam_id){ q+=' AND r.exam_id=?'; p.push(exam_id);}
  if(student_id){ q+=' AND r.student_id=?'; p.push(student_id);}
  res.json(db.prepare(q).all(...p));
});
app.post('/api/results/bulk', verify, (req,res)=>{
  const {exam_id, subject, entries} = req.body; // entries [{student_id,marks}]
  const stmt=db.prepare('INSERT OR REPLACE INTO results (exam_id, student_id, subject, marks, grade) VALUES (?,?,?,?,?)');
  function grade(m){ if(m>=80) return 'D1'; if(m>=70) return 'D2'; if(m>=60) return 'C3'; if(m>=50) return 'C4'; if(m>=40) return 'C5'; if(m>=35) return 'C6'; if(m>=28) return 'P7'; if(m>=20) return 'P8'; return 'F9';}
  const tx=db.transaction((en)=>{ for(const e of en) stmt.run(exam_id, e.student_id, subject, e.marks, grade(e.marks)); });
  try{ tx(entries); res.json({ok:true}); }catch(e){ res.status(400).json({error:e.message});}
});

// Payroll generate
app.post('/api/payroll/generate', verify, (req,res)=>{
  const {month} = req.body; // YYYY-MM
  const staff = db.prepare('SELECT * FROM staff').all();
  const stmt=db.prepare('INSERT OR REPLACE INTO payroll (staff_id, month, basic, allowances, deductions, net) VALUES (?,?,?,?,?,?)');
  const tx=db.transaction(()=>{
    for(const s of staff){
      const basic = s.salary||0;
      const allowances = Math.round(basic*0.1);
      const deductions = Math.round(basic*0.05);
      const net = basic+allowances-deductions;
      stmt.run(s.id, month, basic, allowances, deductions, net);
    }
  });
  tx();
  res.json({ok:true, count: staff.length});
});

// Finance overview
app.get('/api/finance/summary', verify, (req,res)=>{
  const totalFees = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM payments').get().s;
  const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM expenses').get().s;
  const totalIncome = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM incomes').get().s;
  const balance = (totalFees+totalIncome) - totalExpenses;
  res.json({totalFees, totalExpenses, totalIncome, balance});
});

// Dashboard stats
app.get('/api/dashboard', verify, (req,res)=>{
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
app.post('/api/promote', verify, (req,res)=>{
  const {from_class, to_class, year} = req.body;
  const students = db.prepare('SELECT * FROM students WHERE class=?').all(from_class);
  const upd = db.prepare('UPDATE students SET class=? WHERE id=?');
  const ins = db.prepare('INSERT INTO promotions (student_id, from_class, to_class, year, date) VALUES (?,?,?,?,?)');
  const tx=db.transaction(()=>{
    for(const s of students){
      upd.run(to_class, s.id);
      ins.run(s.id, from_class, to_class, year, dayjs().format('YYYY-MM-DD'));
    }
  });
  tx();
  res.json({promoted: students.length});
});

// AI Tutor - simple rule based
app.post('/api/ai-tutor', verify, (req,res)=>{
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
app.post('/api/sms/send', verify, (req,res)=>{
  const {recipients, message, type} = req.body; // recipients [{phone,name}]
  const stmt=db.prepare('INSERT INTO sms_logs (recipient, phone, message, type) VALUES (?,?,?,?)');
  const tx=db.transaction(()=>{
    for(const r of recipients) stmt.run(r.name||r.phone, r.phone, message, type||'General');
  });
  tx();
  // In production integrate with Africa's Talking / Twilio
  res.json({sent: recipients.length, note:'SMS queued (mock - integrate SMS gateway in production)'});
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

// Backup
app.get('/api/backup', verify, (req,res)=>{
  const src = path.join(__dirname,'../data/school.db');
  if(!fs.existsSync(src)) return res.status(404).json({error:'No DB file'});
  res.download(src, `backup_${dayjs().format('YYYY-MM-DD')}.db`);
});
app.post('/api/restore', verify, (req,res)=>{
  res.json({note:'Restore via uploading DB file to /data/school.db and restart server'});
});
app.post('/api/seed', verify, (req,res)=>{
  try{ require('./seed'); res.json({ok:true, note:'Seeded demo data (50 students etc.)'}); }catch(e){ res.status(500).json({error:e.message}); }
});

// Other CRUDs
app.use('/api/staff', crud('staff'));
app.use('/api/classes', crud('classes'));
app.use('/api/subjects', crud('subjects'));
app.use('/api/exams', crud('exams'));
app.use('/api/fees-structure', crud('fees_structure'));
app.use('/api/payments', crud('payments'));
app.use('/api/expenses', crud('expenses'));
app.use('/api/incomes', crud('incomes'));
app.use('/api/suppliers', crud('suppliers'));
app.use('/api/requisitions', crud('requisitions'));
app.use('/api/purchase-orders', crud('purchase_orders'));
app.use('/api/inventory', crud('inventory'));
app.use('/api/goods-received', crud('goods_received'));
app.use('/api/medical-records', crud('medical_records'));
app.use('/api/medicines', crud('medicines'));
app.use('/api/vehicles', crud('vehicles'));
app.use('/api/drivers', crud('drivers'));
app.use('/api/routes', crud('routes'));
app.use('/api/transport-reg', crud('transport_reg'));
app.use('/api/trips', crud('trips'));
app.use('/api/events', crud('events'));
app.use('/api/sms-logs', crud('sms_logs'));
app.use('/api/payrolls', crud('payroll'));

// Reports
app.get('/api/reports/income-statement', verify, (req,res)=>{
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
app.get('/api/reports/balance-sheet', verify, (req,res)=>{
  const assets = db.prepare('SELECT COALESCE(SUM(quantity*unit_price),0) as s FROM inventory').get().s;
  const cash = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM payments').get().s - db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM expenses').get().s;
  const liabilities = 0;
  res.json({assets: assets+cash, cash, inventory:assets, liabilities, equity: assets+cash - liabilities});
});

// Serve frontend
app.use(express.static(path.join(__dirname,'../public')));
app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'../public/index.html')));

app.listen(PORT, ()=> console.log(`EduControl running on http://localhost:${PORT} | Admin: admin / admin123`));
