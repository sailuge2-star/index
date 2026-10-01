'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function mockResponse(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.data=v;return this},writeHead(n,h){this.statusCode=n;this.headers=h},end(s){this.data=JSON.parse(s)}};}
(async()=>{
 // API proxy: successful cookie handling, CSRF, tampering, invalid certificate, no secret in response.
 const env={SOOP_RELAY_URL:'https://relay.example',SOOP_RELAY_KEY:'relay-key-for-test'.repeat(3),SOOP_SESSION_SECRET:'session-test'.repeat(4)};
 let forwarded=0;
 const context={module:{exports:{}},require,Buffer,URLSearchParams,AbortSignal,process:{env},fetch:async()=>{forwarded++;return {ok:true,json:async()=>({id:'a'.repeat(64),connected:true,latest:0})}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'api/soop-connect.js'),'utf8'),context);const handler=context.module.exports;
 const request={method:'POST',query:{action:'connect'},headers:{origin:'https://bboringril.vercel.app'},body:{certificationNumber:'123456'}};
 const r=mockResponse();await handler(request,r);assert.equal(r.statusCode,200);assert(!('id'in r.data));assert(r.headers['Set-Cookie'].includes('HttpOnly; Secure; SameSite=Strict'));const cookie=r.headers['Set-Cookie'].split(';')[0];
 const csrf=mockResponse();await handler({...request,headers:{origin:'https://evil.example'}},csrf);assert.equal(csrf.statusCode,403);
 const invalid=mockResponse();await handler({...request,body:{certificationNumber:'123'}},invalid);assert.equal(invalid.statusCode,400);
 const tampered=mockResponse();await handler({method:'GET',query:{action:'events'},headers:{cookie:cookie.slice(0,-4)+'xxxx'}},tampered);assert.equal(tampered.data.connected,false);assert.equal(forwarded,1);
 console.log('PASS proxy cookie encryption, token exclusion, CSRF, tampering, input validation');
 // Relay: real request handler, mocked SOOP and headless browser only.
 let serve,exposed={},closed=0,wrongChannel=false;
 const relayEnv={SOOP_CLIENT_ID:'id',SOOP_CLIENT_SECRET:'secret',SOOP_RELAY_KEY:'k'.repeat(40)};
 const fakePage={exposeFunction:async(k,fn)=>{exposed[k]=fn},addScriptTag:async()=>{},evaluate:async()=>{}};
 const sandbox={require:n=>n==='node:http'?{createServer:fn=>{serve=fn;return {listen(){},close(){}}}}:n==='playwright'?{chromium:{launch:async()=>({newContext:async()=>({newPage:async()=>fakePage,close:async()=>{closed++}})})}}:require(n),Buffer,URL,URLSearchParams,AbortSignal,process:{env:relayEnv,on(){},exit(){}},setInterval:()=>({unref(){}}),fetch:async url=>({ok:true,json:async()=>url.endsWith('/auth/code')?{code:'code'}:url.endsWith('/auth/token')?{access_token:'secret-access',expires_in:3600}:url.endsWith('/user/stationinfo')?{result:1,data:{user_nick:'test'}}:{result:1,data:[{id:wrongChannel?'another':'bboringirl'}]}})};
 vm.runInNewContext(fs.readFileSync(path.join(root,'soop-relay/server.cjs'),'utf8'),sandbox);
 function req(url,method='GET',data={},authorized=true){return {url,method,headers:{authorization:authorized?'Bearer '+relayEnv.SOOP_RELAY_KEY:''},async *[Symbol.asyncIterator](){yield JSON.stringify(data)}}}
 const unauthorized=mockResponse();await serve(req('/connect','POST',{},false),unauthorized);assert.equal(unauthorized.statusCode,401);
 wrongChannel=true;const denied=mockResponse();await serve(req('/connect','POST',{certificationNumber:'123456'}),denied);assert.equal(denied.statusCode,502);
 wrongChannel=false;const connected=mockResponse();await serve(req('/connect','POST',{certificationNumber:'123456'}),connected);assert.equal(connected.statusCode,200);const sid=connected.data.id;await new Promise(resolve=>setImmediate(resolve));
 exposed.relayEvent('BALLOON_GIFTED',{bjId:'another',count:10});exposed.relayEvent('BALLOON_GIFTED',{bjId:'bboringirl',count:10,fromVod:true});
 exposed.relayEvent('BALLOON_GIFTED',{bjId:'bboringirl',count:10,userNickname:'tester'});
 const events=mockResponse();await serve(req('/sessions/'+sid+'/events?after=0'),events);assert.equal(events.data.events.length,1);assert.equal(events.data.events[0].count,10);
 const again=mockResponse();await serve(req('/sessions/'+sid+'/events?after=1'),again);assert.equal(again.data.events.length,0);
 const disconnect=mockResponse();await serve(req('/sessions/'+sid,'DELETE'),disconnect);assert.equal(closed,1);
 console.log('PASS relay authorization, owner channel, VOD exclusion, event cursor, disconnect');
 // Game effects are exercised from the actual MainScene method.
 const game=fs.readFileSync(path.join(root,'game.js'),'utf8');const method=game.slice(game.indexOf('    applySoopDonation('),game.indexOf('    autoAttack()'));
 const C=vm.runInNewContext('(class {'+method+'})',{window:{BBO_GAME_ACCESS:{isAdmin:()=>false}},document:{getElementById:()=>null},SURVIVAL_SECONDS:1800,BOSS_TYPES:[{key:'boss1'}]});
 const g=new C();g.state={running:true,bossActive:false,elapsed:50,bossRound:0,bossOrder:[{key:'boss2'}]};g.player={hp:50,maxHp:100};g.updateUi=()=>{};
 g.applySoopDonation('help','test',10);assert.equal(g.player.hp,80);g.applySoopDonation('harm','test',15);assert.equal(g.player.hp,60);g.applySoopDonation('shield','test',20);assert.equal(g.player.donationInvulnerableMs,7000);g.applySoopDonation('harm','test',15);assert.equal(g.player.hp,60);
 g.state.pausedForLevel=true;assert.equal(g.applySoopDonation('help','test',10),false);assert.equal(g.player.hp,60);g.state.pausedForLevel=false;
 let enemy;g.enemies={getChildren:()=>enemy?[enemy]:[]};g.spawnBoss=round=>{g.state.bossRound=round;g.state.bossActive=true;enemy={active:true,type:'boss'}};
 g.applySoopDonation('spawn','test',40);assert.equal(g.state.bossRound,0);assert.equal(g.state.bossOrder[0].key,'boss2');assert(enemy.isDonationBoss);
 console.log('PASS game healing, harm, shield, pause, bonus boss progression preservation');
})().catch(e=>{console.error(e);process.exitCode=1});
(async()=>{
 const ids={},timers=[],calls=[],effects=[];
 const inputValues=['10','15','20','33','40','50'];
 const inputs=inputValues.map(value=>({value,dataset:{default:value},addEventListener(){}}));
 for(const id of ['soopConnectAction','soopCertification','soopApprovalNote','soopResetDefaults'])ids[id]={value:'',textContent:'',dataset:{}};
 const badge={},name={};ids.soopConnectDialog={querySelectorAll:()=>inputs,querySelector:s=>s==='.soop-connection-badge'?badge:name,addEventListener(){}};
 const scene={state:{running:true,pausedForUser:false},scene:{isActive:()=>true},applySoopDonation(effect){if(this.state.pausedForUser)return false;effects.push(effect);return true;}};
 const c={document:{getElementById:id=>ids[id]},window:{addEventListener(){},bboringirlGame:{scene:{getScene:()=>scene}}},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('action=status')?{connected:false}:url.includes('action=connect')?{connected:true,chatConnected:true,latest:0}:url.includes('action=events')?{connected:true,chatConnected:true,events:[{seq:1,count:10,nickname:'tester'}]}:{connected:false}}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'soop-popup.js'),'utf8'),c);
 await new Promise(r=>setImmediate(r));ids.soopCertification.value='123456';await ids.soopConnectAction.onclick();assert.equal(ids.soopCertification.value,'');assert.equal(badge.textContent,'후원 수신 중');
 await timers.shift()();assert.deepEqual(effects,['help']);await timers.shift()();assert.deepEqual(effects,['help']);
 assert(calls.some(c=>c.options.method==='POST'&&c.options.body.includes('123456')));
 console.log('PASS popup connection, credential clearing, donation dispatch and duplicate cursor filtering');
})().catch(e=>{console.error(e);process.exitCode=1});
