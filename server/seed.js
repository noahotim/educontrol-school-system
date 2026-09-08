const db = require('./db');
const dayjs = require('dayjs');
const bcrypt = require('bcryptjs');

function seed(){
  console.log('Seeding demo data...');
  // add users
  const users = [
    ['bursar','bursar123','bursar','Bursar Office','bursar@school.local'],
    ['teacher1','teacher123','teacher','Mr. Okello','okello@school.local'],
    ['nurse','nurse123','nurse','Sickbay Nurse','nurse@school.local'],
  ];
  users.forEach(u=>{
    try{
      const h=bcrypt.hashSync(u[1],10);
      db.prepare('INSERT OR IGNORE INTO users (username,password,role,name,email) VALUES (?,?,?,?,?)').run(u[0],h,u[2],u[3],u[4]);
    }catch(e){}
  });
  // students
  const firstNames=['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','David','Sarah','Joseph','Grace','Daniel','Peace','Moses','Ruth','Emmanuel','Priscilla','Samuel','Esther'];
  const lastNames=['Okello','Nakato','Mukasa','Namusoke','Ssemwanga','Achieng','Kato','Babirye','Otim','Atim','Wasswa','Nabirye','Kizito','Namata','Opondo','Adong','Mugisha','Kemigisha','Tumusiime','Atuhaire'];
  const classes=['P1','P2','P3','P4','P5','P6','P7','S1','S2','S3'];
  if(db.prepare('SELECT COUNT(*) as n FROM students').get().n < 40){
    for(let i=0;i<50;i++){
      const fn=firstNames[i%firstNames.length];
      const ln=lastNames[(i*3)%lastNames.length];
      const cls=classes[Math.floor(Math.random()*classes.length)];
      const adm='ADM'+String(2024001+i).padStart(7,'0');
      try{ db.prepare('INSERT OR IGNORE INTO students (admission_no, first_name,last_name,gender,dob,class,parent_name,parent_phone,admission_date,status) VALUES (?,?,?,?,?,?,?,?,?,?)').run(adm,fn,ln, i%2?'Female':'Male', dayjs().subtract(10+Math.floor(Math.random()*8),'year').format('YYYY-MM-DD'), cls, `Parent of ${fn}`, `07${Math.floor(70000000+Math.random()*9999999)}`, dayjs().subtract(Math.floor(Math.random()*300),'day').format('YYYY-MM-DD'),'Active'); }catch(e){}
    }
  }
  // staff
  if(db.prepare('SELECT COUNT(*) as n FROM staff').get().n < 5){
    const staff=[['STF001','Mr. Kato Patrick','Male','Academics','Head Teacher','0772123456','kato@school.local','Masters',1200000],['STF002','Ms. Nalule Grace','Female','Finance','Bursar','0755123456','nalule@school.local','BCom',900000],['STF003','Mr. Ocheng Denis','Male','Transport','Driver','0712123456','ocheng@school.local','Diploma',500000],['STF004','Ms. Atim Faith','Female','Medical','Nurse','0788123456','atim@school.local','Nursing',800000],['STF005','Mr. Mugisha Henry','Male','Academics','Teacher','0700123456','mugisha@school.local','Degree',700000]];
    staff.forEach(s=> { try{ db.prepare('INSERT OR IGNORE INTO staff (staff_no,name,gender,department,role,phone,email,qualification,salary,hire_date) VALUES (?,?,?,?,?,?,?,?,?,?)').run(...s, dayjs().subtract(300,'day').format('YYYY-MM-DD')); }catch(e){}});
  }
  // inventory
  if(db.prepare('SELECT COUNT(*) as n FROM inventory').get().n===0){
    const items=[['A4 Paper','Stationery',100,'Ream',25000,'Store',20],['Chalk','Stationery',50,'Box',5000,'Store',10],['Desks','Furniture',80,'Pcs',80000,'Class Block',5],['Lab Chemicals','Laboratory',30,'Set',150000,'Lab',5],['Football','Sports',15,'Pcs',60000,'Sports Dept',5]];
    items.forEach(it=> db.prepare('INSERT OR IGNORE INTO inventory (item,category,quantity,unit,unit_price,location,low_stock) VALUES (?,?,?,?,?,?,?)').run(...it));
  }
  // medicines
  if(db.prepare('SELECT COUNT(*) as n FROM medicines').get().n===0){
    [['Paracetamol',100,'tabs','2027-12-01','Joint Medical Store'],['Amoxicillin',60,'caps','2027-06-01','NMS'],['ORS',80,'sachet','2027-01-01','JMS'],['Bandage',40,'roll','2026-12-01','Local'],['Antiseptic',25,'bottle','2027-03-01','JMS']].forEach(m=> db.prepare('INSERT OR IGNORE INTO medicines (name,quantity,unit,expiry,supplier) VALUES (?,?,?,?,?)').run(...m));
  }
  // vehicles/routes
  if(db.prepare('SELECT COUNT(*) as n FROM vehicles').get().n===0){
    [['UAX 123A','Bus',60,'Mr. Ocheng'],['UAY 456B','Van',14,'Mr. Kato']].forEach(v=> db.prepare('INSERT OR IGNORE INTO vehicles (reg_no,type,capacity,driver) VALUES (?,?,?,?)').run(...v));
    db.prepare('INSERT OR IGNORE INTO routes (name,stops,fee) VALUES (?,?,?)').run('Kampala - School','Wandegeya, Bwaise, Kawempe',150000);
    db.prepare('INSERT OR IGNORE INTO routes (name,stops,fee) VALUES (?,?,?)').run('Ntinda - School','Ntinda, Kiwatule, Najjera',120000);
  }
  // fees structure
  if(db.prepare('SELECT COUNT(*) as n FROM fees_structure').get().n===0){
    [['P1','Term I',450000,'Tuition','2026-02-15'],['P7','Term I',650000,'Tuition + PLE','2026-02-15'],['S4','Term I',850000,'Tuition + UNEB','2026-02-15']].forEach(f=> db.prepare('INSERT INTO fees_structure (class,term,amount,description,due_date) VALUES (?,?,?,?,?)').run(...f));
  }
  // exams
  if(db.prepare('SELECT COUNT(*) as n FROM exams').get().n===0){
    db.prepare('INSERT INTO exams (name,term,year,class,date) VALUES (?,?,?,?,?)').run('Beginning of Term I','Term I','2026','P7', dayjs().format('YYYY-MM-DD'));
    db.prepare('INSERT INTO exams (name,term,year,class,date) VALUES (?,?,?,?,?)').run('Mid Term I','Term I','2026','S4', dayjs().format('YYYY-MM-DD'));
  }
  // payments
  if(db.prepare('SELECT COUNT(*) as n FROM payments').get().n===0){
    const studs=db.prepare('SELECT id FROM students LIMIT 10').all();
    studs.forEach((s,i)=> {
      db.prepare('INSERT OR IGNORE INTO payments (student_id, amount, method, receipt_no, term, date) VALUES (?,?,?,?,?,?)').run(s.id, 300000+Math.floor(Math.random()*200000),'Cash','REC'+(1001+i),'Term I', dayjs().subtract(i,'day').format('YYYY-MM-DD'));
    });
    [[ 'Donation','Well wisher donation',500000, dayjs().format('YYYY-MM-DD')],['Canteen','Canteen sales',320000, dayjs().format('YYYY-MM-DD')]].forEach(inc=> db.prepare('INSERT INTO incomes (source,description,amount,date) VALUES (?,?,?,?)').run(...inc));
    [['Utilities','Electricity bill',250000, dayjs().format('YYYY-MM-DD'),'Bursar'],['Stationery','A4 paper purchase',180000, dayjs().format('YYYY-MM-DD'),'Admin']].forEach(e=> db.prepare('INSERT INTO expenses (category,description,amount,date,paid_by) VALUES (?,?,?,?,?)').run(...e));
  }
  // attendance today
  const today=dayjs().format('YYYY-MM-DD');
  const studs=db.prepare('SELECT id FROM students LIMIT 20').all();
  studs.forEach(s=>{
    try{ db.prepare('INSERT OR IGNORE INTO attendance (student_id,date,status) VALUES (?,?,?)').run(s.id, today, Math.random()>0.15?'Present':'Absent'); }catch(e){}
  });
  // events
  if(db.prepare('SELECT COUNT(*) as n FROM events').get().n===0){
    db.prepare('INSERT INTO events (title,type,start_date,end_date,venue,description,audience) VALUES (?,?,?,?,?,?,?)').run('Parents Meeting','Academic',dayjs().add(7,'day').format('YYYY-MM-DD'),dayjs().add(7,'day').format('YYYY-MM-DD'),'Main Hall','Term I parents meeting','Parents');
    db.prepare('INSERT INTO events (title,type,start_date,end_date,venue,description,audience) VALUES (?,?,?,?,?,?,?)').run('Sports Day','Activity',dayjs().add(14,'day').format('YYYY-MM-DD'),dayjs().add(14,'day').format('YYYY-MM-DD'),'School Ground','Annual sports day','All');
  }
  console.log('Seeding done');
}
seed();
