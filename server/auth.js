const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'educontrol-secret-2026-change-me';
const BACKUP_KEY = process.env.BACKUP_KEY || 'educontrol-permanent-2026';
function sign(user){
  return jwt.sign({id:user.id, username:user.username, role:user.role, name:user.name}, SECRET, {expiresIn:'10y'});
}
function verify(req,res,next){
  let token = null;
  const h = req.headers.authorization;
  if(h) token = h.replace('Bearer ','');
  else if(req.query && req.query.token) token = req.query.token;
  if(!token) return res.status(401).json({error:'No token - login first. Use Dashboard -> Backup button while logged in.'});
  try{
    req.user = jwt.verify(token, SECRET);
    next();
  }catch(e){ return res.status(401).json({error:'Invalid token - get fresh token via POST /api/login or use permanent ?key='+BACKUP_KEY}); }
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
module.exports={sign,verify,verifyWithKey,role,SECRET,BACKUP_KEY};
