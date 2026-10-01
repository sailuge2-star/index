(() => {
 'use strict';
 const dialog=document.getElementById('soopConnectDialog');if(!dialog)return;
 const inputs=[...dialog.querySelectorAll('[data-default]')],effects=['help','harm','shield','random','spawn','remove'];
 const button=document.getElementById('soopConnectAction'),number=document.getElementById('soopCertification'),badge=dialog.querySelector('.soop-connection-badge'),note=document.getElementById('soopApprovalNote');
 let connected=false,cursor=0,busy=false,queue=[],timer;
 function amounts(){return inputs.map(i=>Number(i.value));}
 function valid(){const a=amounts();return a.every(n=>Number.isSafeInteger(n)&&n>0&&n<=999999)&&new Set(a).size===a.length;}
 function render(data){connected=Boolean(data.connected);button.textContent=connected?'연결 해제':'연결하기';number.disabled=connected;badge.textContent=connected&&data.chatConnected?'후원 수신 중':connected?'채팅 연결 확인 필요':'연결 안 됨';if(data.message)note.textContent=data.message;if(data.station){dialog.querySelector('.soop-streamer-name').textContent=data.station.nickname;}}
 async function call(action,body){const r=await fetch('/api/soop-connect?action='+action,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'연결 실패');return data;}
 button.onclick=async()=>{if(busy)return;if(!connected&&!valid()){note.textContent='효과별 후원 개수는 서로 다른 양의 정수로 입력해주세요.';return;}if(!connected&&!/^\d{6}$/.test(number.value)){note.textContent='SOOP 앱의 6자리 인증번호를 입력해주세요.';return;}busy=true;button.disabled=true;try{const data=await call(connected?'disconnect':'connect',connected?{}:{certificationNumber:number.value});number.value='';queue=[];cursor=data.latest||0;render(data);if(!connected)note.textContent='연결을 해제했습니다.';}catch(e){note.textContent=e.message;}finally{busy=false;button.disabled=false;}};
 document.getElementById('soopResetDefaults').onclick=()=>inputs.forEach(i=>i.value=i.dataset.default);
 inputs.forEach(i=>{i.dataset.previous=i.value;i.addEventListener('change',()=>{if(!valid()){i.value=i.dataset.previous;note.textContent='후원 개수는 중복 없이 1~999999로 입력해주세요.';}else i.dataset.previous=i.value;});});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 async function poll(){try{
  if(connected&&!busy){const data=await call('events&after='+cursor);render(data);for(const event of data.events||[]){if(event.seq<=cursor)continue;cursor=event.seq;const index=amounts().indexOf(event.count);if(index<0)continue;const scene=window.bboringirlGame?.scene.getScene('MainScene');if(!scene?.state?.running||!scene.scene.isActive())continue;if(queue.length<100)queue.push({scene,event,effect:effects[index],created:Date.now(),state:scene.state});}}
  const next=queue[0];if(next){if(Date.now()-next.created>300000||!next.scene.scene.isActive()||!next.scene.state.running||next.scene.state!==next.state)queue.shift();else if(next.scene.applySoopDonation(next.effect,next.event.nickname,next.event.count))queue.shift();}
 }catch(e){note.textContent=e.message;badge.textContent='연결 확인 필요';}finally{timer=setTimeout(poll,2000);}}
 call('status').then(data=>{cursor=data.latest||0;render(data);}).catch(e=>{note.textContent=e.message;}).finally(poll);
 window.addEventListener('pagehide',()=>clearTimeout(timer));
})();
