(() => {
  'use strict';
  const defaults={player_hp:100,player_damage:18,player_speed:250,enemy_multiplier:1,spawn_ms:900};
  const limits={player_hp:[1,10000],player_damage:[1,999],player_speed:[50,1000],enemy_multiplier:[0.1,20],spawn_ms:[100,10000]};
  let admin=false,settings={...defaults},generation=0,loadError='';
  const cfg=window.BBORINGIRL_CONFIG||{};
  const client=cfg.supabaseUrl&&cfg.supabaseKey&&window.supabase?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey):null;
  function bounded(promise){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('연결 시간이 초과되었습니다.')),8000);Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)});});}
  function validate(values){const result={};for(const [k,[min,max]] of Object.entries(limits)){const v=Number(values[k]);if(!Number.isFinite(v)||v<min||v>max||(k!=='enemy_multiplier'&&!Number.isInteger(v)))throw Error('설정값 범위를 확인해주세요: '+k);result[k]=v;}return result;}
  function render(){
    document.querySelectorAll('[data-game-role]').forEach(e=>e.textContent=admin?'관리자 · 무적 / 공격력 999':'게스트');
    document.querySelectorAll('[data-game-admin]').forEach(e=>e.hidden=!admin);
    document.querySelectorAll('[data-guest-only]').forEach(e=>e.hidden=admin);
    window.dispatchEvent(new Event('game-role-change'));
  }
  async function refresh(){
    const ticket=++generation;admin=false;render();
    let verified=false;
    try{if(client){const {data,error}=await bounded(client.auth.getUser());if(!error&&data.user){const r=await bounded(client.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle());verified=!r.error&&Boolean(r.data);}}}catch{/* Default to guest on any failed verification. */}
    if(ticket===generation){admin=verified;render();}
  }
  async function load(){
    if(!client){loadError='Supabase 연결 설정이 없습니다.';return;}
    try{const {data,error}=await bounded(client.from('game_balance').select('*').eq('id',1).maybeSingle());if(error)throw error;if(data)settings=validate(data);loadError='';}catch(e){loadError='공용 설정을 불러오지 못했습니다. 기본값으로 진행합니다. '+e.message;}
  }
  document.querySelectorAll('a.game-admin-link').forEach(link=>link.addEventListener('click',event=>{
    if(!admin){event.preventDefault();return;}
    const scene=window.bboringirlGame?.scene.getScene('MainScene');
    if(scene?.scene.isActive()&&scene.state?.running){
      scene.state.pausedForUser=true;
      scene.syncPauseState();
    }
  }));
  const ready=Promise.all([refresh(),load()]);
  window.BBO_GAME_ACCESS=Object.freeze({client,isAdmin:()=>admin,settings:()=>({...settings}),ready,
    async save(values){const clean=validate(values);await refresh();if(!admin||!client)throw Error('관리자 로그인 후 이용해주세요.');const {error}=await bounded(client.from('game_balance').upsert({id:1,...clean}));if(error)throw error;settings=clean;loadError='';}
  });
  client?.auth.onAuthStateChange(()=>{admin=false;render();setTimeout(refresh,0);});
  window.addEventListener('focus',refresh);
  if(document.body.dataset.page==='game-admin'){
    const form=document.getElementById('balanceForm'),status=document.getElementById('balanceStatus');
    ready.then(()=>{for(const k of Object.keys(defaults))form.elements[k].value=settings[k];status.textContent=loadError||'저장한 설정은 다음 게임 시작부터 적용됩니다.';});
    document.getElementById('balanceReset').onclick=()=>{for(const k of Object.keys(defaults))form.elements[k].value=defaults[k];status.textContent='기본값을 입력했습니다. 저장을 누르면 적용됩니다.';};
    form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{const values={};for(const k of Object.keys(defaults))values[k]=Number(form.elements[k].value);await window.BBO_GAME_ACCESS.save(values);status.textContent='저장 완료 · 게임 페이지를 새로 열어 시작하면 적용됩니다.';}catch(error){status.textContent='저장 실패: '+error.message+' (game-balance.sql 설정을 확인해주세요.)';}finally{button.disabled=false;}};
  }
})();
