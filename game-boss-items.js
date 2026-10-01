(() => {
 'use strict';
 const DROP_CHANCE=0.3;
 const NAMES=['전멸의 별','경험치 자석','반쪽 회복 물약','완전 회복 물약','성장의 축복'];
 class BossItems {
  constructor(scene){this.scene=scene;this.items=[];this.graphics=scene.add.graphics().setDepth(18);this.clock=0;this.wiping=false;this.timer=null;}
  drop(enemy){
   const s=this.scene;
   // 최종 보스는 처치 즉시 클리어되므로 획득 불가능한 상자를 남기지 않는다.
   if(this.wiping||!s.state.running||(!enemy.isDonationBoss&&s.state.elapsed>=1800&&s.state.bossRound===6)||Math.random()>=DROP_CHANCE)return;
   this.items.push({x:enemy.x,y:enemy.y});
  }
  notify(name){const node=document.getElementById('bossItemNotice');if(!node)return;clearTimeout(this.timer);node.textContent=name+' 아이템을 획득하셨습니다!';node.hidden=false;this.timer=setTimeout(()=>{node.hidden=true;},4500);}
  apply(index){
   const s=this.scene,p=s.player;
   if(index===0){
    this.wiping=true;
    try{for(const e of s.enemies.getChildren().slice()){if(!s.state.running)break;if(e.active)s.killEnemy(e);}for(const b of s.enemyProjectiles.getChildren().slice())if(b.active)b.destroy();}finally{this.wiping=false;}
   }else if(index===1){
    let total=0;for(const orb of s.xpOrbs.getChildren().slice()){if(orb.active){total+=orb.xp||0;orb.destroy();}}if(total)s.gainXp(total);
   }else if(index===2){p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*.5));}
   else if(index===3){p.hp=p.maxHp;}
   else if(index===4){
    // 기존 경험치를 보존하면서 정확히 5회의 레벨업 선택을 제공한다.
    let base=s.state.baseNextXp,total=0;
    for(let i=0;i<5;i++){total+=Math.max(1,Math.round(base*.7));base=Math.floor(base*1.28+8);}
    s.gainXp(total);
   }
   this.notify(NAMES[index]);s.updateUi();
  }
  update(delta){
   const s=this.scene;if(!s.state.running||s.state.pausedForLevel||s.state.pausedForUser)return;
   this.clock+=Math.min(delta,100);const g=this.graphics;g.clear();
   for(let i=this.items.length-1;i>=0;i--){
    const item=this.items[i];
    if(Math.hypot(item.x-s.player.x,item.y-s.player.y)<=38){this.items.splice(i,1);this.apply(Math.floor(Math.random()*NAMES.length));if(!s.state.running||s.state.pausedForLevel)break;continue;}
    const y=item.y+Math.sin(this.clock/300)*4;
    g.fillStyle(0xffe7a0,.15).fillCircle(item.x,item.y,29);
    g.fillStyle(0x344d4a,.2).fillEllipse(item.x,item.y+18,34,10);
    g.fillStyle(0xc05a88,1).fillRoundedRect(item.x-15,y-13,30,28,5);
    g.lineStyle(2,0xffe0af,1).strokeRoundedRect(item.x-15,y-13,30,28,5);
    g.fillStyle(0xffdda2,1).fillRect(item.x-3,y-13,6,28).fillRect(item.x-15,y-4,30,5);
    g.lineStyle(3,0xffdda2,1).strokeCircle(item.x-5,y-18,5).strokeCircle(item.x+5,y-18,5);
   }
  }
  destroy(){clearTimeout(this.timer);this.graphics.destroy();this.items=[];const node=document.getElementById('bossItemNotice');if(node)node.hidden=true;}
 }
 window.BBOBossItems=BossItems;
})();
