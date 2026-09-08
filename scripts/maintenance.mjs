// Toggle the maintenance kill-switch (system_config/maintenance) out-of-band.
// SUES-exact safety net: because the lock denies EVERY sign-in (except admin),
// the UI cannot reopen once locked. Use this script instead.
//
// Usage:
//   node scripts/maintenance.mjs on  [message]   (lock everything — CONTACT NOAH)
//   node scripts/maintenance.mjs off             (reopen everything)
//   node scripts/maintenance.mjs show            (print current state)
//   node scripts/maintenance.mjs on --url https://educontrol-gif2.onrender.com --user admin --pass admin123 "Custom message"

import { readFileSync } from "fs";
const args = process.argv.slice(2);
const state = args[0];
const customMessage = args.find(a=> !a.startsWith('--') && a!==state);
const urlIdx = args.indexOf('--url');
const userIdx = args.indexOf('--user');
const passIdx = args.indexOf('--pass');
const baseUrl = urlIdx!==-1 ? args[urlIdx+1] : process.env.EDUCONTROL_URL || "https://educontrol-gif2.onrender.com";
const username = userIdx!==-1 ? args[userIdx+1] : "admin";
const password = passIdx!==-1 ? args[passIdx+1] : "admin123";

if(!state || !['on','off','show'].includes(state)){
  console.error('Usage: node scripts/maintenance.mjs <on|off|show> [message] [--url URL --user admin --pass admin123]');
  process.exit(1);
}

async function api(path, opts={}){
  const r = await fetch(`${baseUrl}${path}`, opts);
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error || j.message || `HTTP ${r.status}`);
  return j;
}

const DEFAULT_MESSAGE = "Access to this system is temporarily locked.\nCONTACT NOAH to be authorised.";

if(state==='show'){
  const j = await api('/api/maintenance/status');
  console.log(`maintenance = ${j.enabled ? 'ON (locked)' : 'OFF (open)'}`);
  if(j.message) console.log(`message: ${JSON.stringify(j.message)}`);
  if(j.enabled_until) console.log(`enabled_until: ${j.enabled_until}`);
  process.exit(0);
}

const login = await api('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password})});
const token = login.token;

const enabled = state==='on';
const msg = enabled ? (customMessage || DEFAULT_MESSAGE) : DEFAULT_MESSAGE;

const res = await api('/api/maintenance/toggle', {
  method:'POST',
  headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
  body: JSON.stringify({enabled, message: msg})
});

console.log(enabled ? 'System LOCKED. Every non-admin sign-in is now denied and CONTACT NOAH lockout is shown.' : 'System REOPENED. Normal sign-in has resumed.');
console.log(`enabled=${res.enabled} until=${res.enabled_until||'manual'}`);
