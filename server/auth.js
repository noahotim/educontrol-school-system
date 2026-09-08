const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'educontrol-secret-2026-change-me';
function sign(user){
  return jwt.sign({id:user.id, username:user.username, role:user.role, name:user.name}, SECRET, {expiresIn:'7d'});
}
function verify(req,res,next){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({error:'No token'});
  const token = h.replace('Bearer ','');
  try{
    req.user = jwt.verify(token, SECRET);
    next();
  }catch(e){ return res.status(401).json({error:'Invalid token'}); }
}
function role(...roles){
  return (req,res,next)=>{
    if(!roles.includes(req.user.role)) return res.status(403).json({error:'Forbidden'});
    next();
  }
}
module.exports={sign,verify,role,SECRET};
