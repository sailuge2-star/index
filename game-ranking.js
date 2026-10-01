(() => {
 'use strict';
 const client=window.BBO_GAME_ACCESS?.client;
 const field=document.getElementById('playerNickname'),hint=document.getElementById('playerNameHint'),dialog=document.getElementById('rankingDialog'),status=document.getElementById('rankingStatus'),rows=document.getElementById('rankingRows'),filter=document.getElementById('rankingDifficulty');
 let guest='',identityPending,loadVersion=0,activeRun;
 function bounded(promise){return Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('연결 시간 초과')),8000);Promise.resolve(promise).finally(()=>clearTimeout(timer)).catch(()=>{});})]);}
 try{field.value=localStorage.getItem('bbo-player-nickname')||'';}catch{}
 field.addEventListener('input',()=>{try{localStorage.setItem('bbo-player-nickname',field.value);}catch{}});
 async function identity(){
  if(identityPending)return identityPending;
  identityPending=(async()=>{
   if(!client)throw Error('DB 연결 설정이 없습니다.');
   const session=await bounded(client.auth.getSession());if(session.error)throw session.error;
   if(!session.data.session){const result=await bounded(client.auth.signInAnonymously());if(result.error)throw result.error;}
   const {data,error}=await bounded(client.rpc('game_guest_name'));if(error)throw error;
   guest=data;field.placeholder=guest+' (비워두면 자동 사용)';hint.textContent='빈칸이면 '+guest+' · 닉네임 최대 20자';return guest;
  })().finally(()=>{identityPending=null;});
  return identityPending;
 }
 function message(text){document.getElementById('rankingSaveStatus').textContent=text;}
 async function prepare(){
  hint.textContent='게스트 번호와 랭킹 연결을 준비하고 있습니다…';
  try{await identity();return true;}catch{guest='';hint.textContent='온라인 랭킹 준비 실패 · DB 설정과 네트워크를 확인해주세요.';return false;}
 }
 function begin(difficulty){
  message('');
  return activeRun={id:crypto.randomUUID(),nickname:field.value.trim().slice(0,20)||guest||'게스트'+Date.now(),difficulty,eligible:Boolean(guest)&&!window.BBO_GAME_ACCESS?.isAdmin(),saved:false};
 }
 async function finish(run,state,cleared){
  if(!run||run.saved)return;run.saved=true;
  if(!run.eligible||window.BBO_GAME_ACCESS?.isAdmin()){message('랭킹 미등록 · 관리자 모드 또는 오프라인 플레이');return;}
  message('랭킹 기록 저장 중…');
  const payload={p_run_id:run.id,p_nickname:run.nickname,p_difficulty:run.difficulty,p_cleared:cleared,p_survival:state.elapsed,p_kills:state.kills};
  try{const {error}=await bounded(client.rpc('game_save_record',payload));if(error)throw error;message(run.nickname+' · 랭킹 기록 저장 완료');}
  catch{run.saved=false;message('랭킹 저장 실패 · 아래 버튼으로 다시 시도해주세요.');const retry=document.getElementById('rankingRetry');retry.hidden=false;retry.onclick=async()=>{retry.hidden=true;await finish(run,state,cleared);};}
 }
 async function load(){
  const version=++loadVersion;rows.replaceChildren();status.textContent='랭킹 불러오는 중…';
  try{
   if(!client)throw Error('DB 없음');
   const {data,error}=await bounded(client.rpc('game_leaderboard',{p_difficulty:filter.value}));if(error)throw error;if(version!==loadVersion)return;
   status.textContent=data.length?'난이도별 개인 최고 기록 · 상위 50명':'아직 등록된 기록이 없습니다. 첫 기록을 남겨보세요!';
   data.forEach((r,i)=>{const tr=document.createElement('tr');[i+1,r.nickname,r.cleared?'클리어':'도전',Math.floor(r.survival/60)+':'+String(r.survival%60).padStart(2,'0'),r.kills.toLocaleString()].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});rows.append(tr);});
  }catch{if(version===loadVersion)status.textContent='랭킹을 불러오지 못했습니다. DB 설정 또는 네트워크를 확인하고 새로고침해주세요.';}
 }
 document.getElementById('openRanking').onclick=()=>{dialog.showModal();load();};
 document.getElementById('rankingRefresh').onclick=load;filter.onchange=load;
 dialog.addEventListener('close',()=>{loadVersion++;});
 window.addEventListener('game-role-change',()=>{if(window.BBO_GAME_ACCESS?.isAdmin()){if(activeRun)activeRun.eligible=false;message('관리자 플레이는 랭킹에서 제외됩니다.');}});
 window.BBO_RANKING=Object.freeze({prepare,begin,finish});
})();
