# EduControl — ONE SCHOOL. ONE SYSTEM. COMPLETE CONTROL.

Modern all-in-one School Management System for academic, financial, administrative, medical, transport and communication operations.

> **Best FREE hosting for this full-stack system: `Render` (from your list).** 
> Why not GitHub Pages / Netlify / Vercel static? They only serve static files — this system needs a Node.js server + database (payments, attendance, results, etc.). **Render free tier** runs Node + SQLite and can host the whole app at `https://your-app.onrender.com`. Alternative full-stack free: Sevalla.com, Firebase Hosting + Functions, AWS Amplify, or Vercel + Neon Postgres.

## ✅ Features Implemented
- **Academic:** Admission & registration, class & promotion, exams/results, automatic report cards, attendance, AI Tutor (personalized), performance analysis (charts)
- **Staff:** Registration, attendance, payroll (auto allowances/deductions), performance
- **Finance:** Fees structure, payments & receipts, expenses, incomes, income statement, balance sheet, reports & charts
- **Procurement:** Requisitions, suppliers, PO, goods received, stock & inventory (low-stock alerts)
- **Sickbay:** Medical records, visits, medicines stock
- **Transport:** Vehicles, drivers, routes/trips, student registration
- **Events:** School/academic/meeting scheduling
- **SMS & Comms:** Send to parents/students, fee/attendance/announcement templates (mock gateway — plug Africa's Talking/Twilio)
- **Backup & Security:** One-click .db backup, restore, JWT auth, bcrypt, role-based (admin/bursar/teacher/nurse)
- **Dashboards & Reports:** Live KPIs, fees trend, students by class, expenses by category, attendance trend

## 🚀 Run Locally
```bash
npm install
npm run seed   # first time: demo data (50 students, staff, etc.)
npm start      # http://localhost:3000
# Login: admin / admin123  (also bursar/bursar123, teacher1/teacher123, nurse/nurse123)
```

## 🌐 Deploy to Render (Recommended — Free)
1. Push this folder to GitHub (see below)
2. Go to https://dashboard.render.com → New → Web Service → Connect your repo
3. Build: `npm install`  Start: `npm start`  (auto-detected from render.yaml)
4. Add env var `JWT_SECRET` (Generate) — done. Your app is live.
5. For persistence on Render free (ephemeral FS), either upgrade to add a Disk for `/data`, or switch DB to **Neon Postgres** (free) and set `DATABASE_URL`.

## 🌐 Alternative Free Hosts
- **Vercel + Neon/Supabase Postgres:** keep frontend same, move API to Vercel Functions.
- **Firebase:** host static + Cloud Functions for API.
- **Sevalla.com / Railway / Fly.io:** also support Node + DB.
- **GitHub Pages / Netlify / Cloudflare Pages / Surge / Neocities / Carrd:** static-only — would require splitting API to another host.

## 🔐 Roles
`admin` full • `bursar` finance • `teacher` academics • `nurse` sickbay — enforced via JWT middleware.

## 🔌 SMS Gateway
Replace mock in `server/index.js: POST /api/sms/send` with:
```js
// Africa's Talking example
const AfricasTalking = require('africastalking')({apiKey, username});
await AfricasTalking.SMS.send({to: recipients.map(r=>r.phone), message});
```

## 📦 Tech
Node.js + Express + better-sqlite3 (zero-config) + vanilla JS + Chart.js + Remix Icons. Single container — no build step.

## 📄 License
MIT — use for any school.
