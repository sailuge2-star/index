'use strict';
const http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const env=process.env, PORT=Number(env.PORT||8080), ALLOWED=env.SOOP_STREAMER_ID||'bboringirl';
for(const k of ['SOOP_CLIENT_ID','SOOP_CLIENT_SECRET','SOOP_RELAY_KEY'])if(!env[k])throw Error('Missing '+k);
if(env.SOOP_RELAY_KEY.length<32)throw Error('SOOP_RELAY_KEY must have at least 32 characters');
const sessions=new Map();let browserPromise,connecting=false,attempts=[];
function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&crypto.timingSafeEqual(x,y);}
async function api(path,data){const r=await fetch('https://openapi.sooplive.com'+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('SOOP API 응답 오류');const v=await r.json();if(v.error||v.result<0)throw Error('SOOP 인증 또는 권한을 확인해주세요.');return v;}
function response(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const b of req){text+=b;if(text.length>4096)throw Error('요청이 너무 큽니다.');}return JSON.parse(text||'{}');}
async function close(s){s.closed=true;sessions.delete(s.id);await s.context?.close().catch(()=>{});}
function publicStatus(s){return {connected:true,chatConnected:s.chatConnected,station:s.station,expiresAt:s.expiresAt,message:s.message,latest:s.seq};}
async function startSDK(s){
  if(!browserPromise)browserPromise=chromium.launch({headless:true,args:['--disable-dev-shm-usage']}).catch(e=>{browserPromise=null;throw e;});
  s.context=await (await browserPromise).newContext();if(s.closed){await s.context.close();return;}const page=await s.context.newPage();
  // Only the official SDK executes here. The Client Secret never reaches visitors.
  await page.exposeFunction('relayEvent',(action,message)=>{
    if(!s.chatConnected||!['BALLOON_GIFTED','ADBALLOON_GIFTED','VIDEOBALLOON_GIFTED'].includes(action))return;
    if(String(message?.bjId)!==ALLOWED||message.fromVod||message.fromStation||message.relaysBroad)return;
    const count=Number(message.count);if(!Number.isSafeInteger(count)||count<1||count>999999)return;
    s.events.push({seq:++s.seq,at:Date.now(),action,count,nickname:String(message.userNickname||'후원자').slice(0,60)});
    if(s.events.length>500)s.events.shift();
  });
  await page.exposeFunction('relayError',()=>{s.chatConnected=false;s.message='채팅 연결이 끊어졌습니다. 연결 해제 후 다시 인증해주세요.';});
  await page.addScriptTag({url:'https://static.sooplive.com/asset/app/chat-sdk/sooplive-chat-sdk.js'});
  await page.evaluate(({id,secret,token,allowed})=>new Promise((resolve,reject)=>{
    const sdk=new window.SOOP.ChatSDK(id,secret);window.relaySDK=sdk;
    const timer=setTimeout(()=>reject(Error('SDK ready timeout')),20000);
    sdk.init?.();sdk.handleMessageReceived((action,message)=>window.relayEvent(action,message));
    sdk.handleReady(()=>{
      const room=sdk.getRoomInfo();
      clearTimeout(timer);
      if(String(room.bjId)!==allowed){sdk.disconnect();reject(Error('Unexpected channel'));return;}
      resolve();
    });
    sdk.handleChatClosed(()=>window.relayError());
    sdk.handleError(()=>{clearTimeout(timer);window.relayError();reject(Error('SDK connection error'));});
    sdk.setAuth(token);sdk.connect().catch(()=>{clearTimeout(timer);reject(Error('SDK connect failed'));});
  }),{id:env.SOOP_CLIENT_ID,secret:env.SOOP_CLIENT_SECRET,token:s.token,allowed:ALLOWED});
  delete s.token;
  s.chatConnected=true;s.message='후원 이벤트 수신 중';
}
const server=http.createServer(async(req,res)=>{
 if(req.url==='/health'){return response(res,200,{ok:true});}
 if(!equal(req.headers.authorization,'Bearer '+env.SOOP_RELAY_KEY))return response(res,401,{error:'인증 실패'});
 try{
  const url=new URL(req.url,'http://relay');
  if(req.method==='POST'&&url.pathname==='/connect'){
   if(connecting)return response(res,409,{error:'다른 연결 요청을 처리 중입니다.'});
   attempts=attempts.filter(t=>Date.now()-t<60000);
   if(attempts.length>=5)return response(res,429,{error:'인증 요청이 많습니다. 1분 후 다시 시도해주세요.'});
   attempts.push(Date.now());
   const input=await body(req);if(!/^\d{6}$/.test(String(input.certificationNumber)))return response(res,400,{error:'SOOP 앱의 6자리 인증번호를 입력해주세요.'});
   connecting=true;
   try{
    const code=await api('/auth/code',{client_id:env.SOOP_CLIENT_ID,auth_type:'api',certification_number:input.certificationNumber,scope:'user_stationinfo broad_access_chatinfo'});
    if(!code.code)throw Error('인증번호가 만료되었거나 승인되지 않았습니다.');
    const token=await api('/auth/token',{grant_type:'authorization_code',client_id:env.SOOP_CLIENT_ID,client_secret:env.SOOP_CLIENT_SECRET,code:code.code});
    if(!token.access_token)throw Error('인증 토큰 발급 실패');
    const station=await api('/user/stationinfo',{access_token:token.access_token});
    const chat=await api('/broad/access/chatinfo',{access_token:token.access_token});
    if(!Array.isArray(chat.data)||!chat.data.some(x=>x.id===ALLOWED))throw Error('뽀린걸 계정의 방송이 진행 중이어야 연결할 수 있습니다.');
    // One active broadcaster session. Reconnection invalidates the old session.
    for(const old of [...sessions.values()])await close(old);
    const ttl=Math.min(4*3600,Number(token.expires_in)||3600);
    const s={id:crypto.randomBytes(32).toString('hex'),token:token.access_token,expiresAt:Date.now()+ttl*1000,station:{nickname:String(station.data?.user_nick||'뽀린걸'),name:String(station.data?.station_name||''),id:ALLOWED},events:[],seq:0,chatConnected:false,message:'채팅 연결 중'};
    sessions.set(s.id,s);
    void startSDK(s).catch(async()=>{s.chatConnected=false;s.message='Chat SDK 연결 실패. 연결 해제 후 다시 인증해주세요.';await s.context?.close().catch(()=>{});});
    return response(res,200,{id:s.id,...publicStatus(s)});
   }finally{connecting=false;}
  }
  const match=url.pathname.match(/^\/sessions\/([a-f0-9]{64})(?:\/(events))?$/);
  const s=match&&sessions.get(match[1]);
  if(!s||s.expiresAt<=Date.now()){if(s)await close(s);return response(res,401,{error:'연결이 만료되었습니다. 다시 인증해주세요.'});}
  if(req.method==='DELETE'){await close(s);return response(res,200,{connected:false});}
  if(req.method!=='GET')return response(res,405,{error:'허용되지 않은 요청'});
  if(match[2]){const after=Number(url.searchParams.get('after'));if(!Number.isSafeInteger(after)||after<0)return response(res,400,{error:'잘못된 요청'});return response(res,200,{...publicStatus(s),events:s.events.filter(x=>x.seq>after)});}
  return response(res,200,publicStatus(s));
 }catch{response(res,502,{error:'SOOP 연결 실패. 인증번호·승인 권한·방송 상태를 확인해주세요.'});}
});
setInterval(()=>{for(const s of sessions.values())if(s.expiresAt<=Date.now())void close(s);},60000).unref();
server.listen(PORT,'0.0.0.0');
process.on('SIGTERM',async()=>{for(const s of [...sessions.values()])await close(s);server.close();process.exit(0);});
