const crypto=require('node:crypto');
const COOKIE='__Host-soop_session';
function seal(id,key){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(key).digest(),iv);const data=Buffer.concat([c.update(JSON.stringify({id,exp:Date.now()+4*3600000})),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64url');}
function unseal(value,key){try{const b=Buffer.from(value,'base64url'),d=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(key).digest(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));const v=JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]));return v.exp>Date.now()&&/^[a-f0-9]{64}$/.test(v.id)?v.id:null;}catch{return null;}}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const url=process.env.SOOP_RELAY_URL,key=process.env.SOOP_RELAY_KEY,secret=process.env.SOOP_SESSION_SECRET;
 if(!url||!key||!secret||secret.length<32)return res.status(503).json({error:'서버 연동 설정이 필요합니다. 관리자에게 문의해주세요.'});
 const origin=process.env.SOOP_SITE_ORIGIN||'https://bboringril.vercel.app';
 const action=req.query.action||'status';
 const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
 const id=unseal(cookie?.slice(COOKIE.length+1)||'',secret);
 const setCookie=(value,age)=>res.setHeader('Set-Cookie',`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`);
 try{
  const mutating=['connect','disconnect'].includes(action);
  if(mutating&&(req.method!=='POST'||req.headers.origin!==origin))return res.status(403).json({error:'동일 사이트에서 다시 요청해주세요.'});
  if(!mutating&&req.method!=='GET')return res.status(405).json({error:'잘못된 요청'});
  if(!['connect','disconnect','status','events'].includes(action))return res.status(400).json({error:'잘못된 요청'});
  if(action==='disconnect'&&!id){setCookie('',0);return res.status(200).json({connected:false});}
  if(action!=='connect'&&!id)return res.status(200).json({connected:false,events:[]});
  let path,method='GET',body;
  if(action==='connect'){
   const input=typeof req.body==='string'?JSON.parse(req.body):req.body;
   if(!/^\d{6}$/.test(String(input?.certificationNumber)))return res.status(400).json({error:'6자리 인증번호를 입력해주세요.'});
   path='/connect';method='POST';body=JSON.stringify({certificationNumber:String(input.certificationNumber)});
  }else{path='/sessions/'+id;if(action==='disconnect')method='DELETE';if(action==='events'){const after=Number(req.query.after||0);if(!Number.isSafeInteger(after)||after<0)return res.status(400).json({error:'잘못된 요청'});path+='/events?after='+after;}}
  if(!url.startsWith('https://'))throw Error('relay HTTPS required');
  const r=await fetch(url.replace(/\/$/,'')+path,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(action==='connect'?55000:10000)});
  const data=await r.json();
  if(!r.ok){if(r.status===401)setCookie('',0);return res.status(r.status).json({error:data.error||'SOOP 연결 오류'});}
  if(action==='connect'){setCookie(seal(data.id,secret),14400);delete data.id;}
  if(action==='disconnect')setCookie('',0);
  return res.status(200).json(data);
 }catch{return res.status(502).json({error:'중계 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'});}
};
