const jwt = require('jsonwebtoken');
const db = require('./db');
const SECRET = process.env.JWT_SECRET || 'educontrol-secret-2026-change-me';
const BACKUP_KEY = process.env.BACKUP_KEY || 'educontrol-permanent-2026';
function sign(user){
  return jwt.sign({id:user.id, username:user.username, role:user.role, name:user.name}, SECRET, {expiresIn:'10y'});
}
// Read the maintenance token-revocation epoch (bumped every time maintenance is ENABLED)
function tokenValidSince(){
  try{
    const m = db.prepare('SELECT token_valid_since FROM maintenance WHERE id=1').get();
    return (m && m.token_valid_since) ? Number(m.token_valid_since) : 0;
  }catch(e){ return 0; }
}
function verify(req,res,next){
  let token = null;
  const h = req.headers.authorization;
  if(h) token = h.replace('Bearer ','');
  else if(req.query && req.query.token) token = req.query.token;
  if(!token) return res.status(401).json({error:'No token - login first. Use Dashboard -> Backup button while logged in.'});
  let decoded = null;
  try{ decoded = jwt.verify(token, SECRET); }
  catch(e){ return res.status(401).json({error:'Invalid token - get fresh token via POST /api/login or use permanent ?key='+BACKUP_KEY}); }
  // HARDENING: never trust the role claim alone - reload the CURRENT user from DB.
  let u = null;
  try{ u = db.prepare('SELECT id, username, role, name, email, must_change_password FROM users WHERE id=?').get(decoded.id); }catch(e){}
  if(!u) return res.status(401).json({error:'Account no longer exists - login again'});
  // HARDENING: session revocation - enabling maintenance bumps token_valid_since,
  // so every token issued before that is dead for non-admin roles immediately.
  try{
    const epoch = tokenValidSince();
    if(epoch && decoded.iat && Number(decoded.iat) < epoch && u.role !== 'admin'){
      return res.status(401).json({error:'Session revoked - maintenance is enabled. Only admin access.'});
    }
  }catch(e){}
  req.user = { id:u.id, username:u.username, role:u.role, name:u.name, email:u.email, must_change_password:u.must_change_password };
  next();
}
function verifyWithKey(req,res,next){
  // Permanent key bypass — for backup without expiry
  if(req.query && req.query.key && req.query.key === BACKUP_KEY) return next();
  return verify(req,res,next);
}
function role(...roles){
  return (req,res,next)=>{
    if(!roles.includes(req.user.role)) return res.status(403).json({error:'Forbidden'});
    next();
  }
}
module.exports={sign,verify,verifyWithKey,role,SECRET,BACKUP_KEY,tokenValidSince};