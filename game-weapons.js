(() => {
 'use strict';
 class ExtraWeapons {
  constructor(scene){this.scene=scene;this.graphics=scene.add.graphics().setDepth(19);this.shells=[];this.blasts=[];this.clock=0;this.angle=0;this.cooldown=0;this.hits=new WeakMap();}
  damage(enemy,amount){const s=this.scene;if(!s.state.running||!enemy.active)return;enemy.hp-=amount;if(enemy.hp<=0)s.killEnemy(enemy);else if(enemy.type==='boss')s.updateBossHud();}
  target(){const s=this.scene;if(s.autoAim!==false)return s.getNearestEnemy();const p=s.input.activePointer;return s.cameras.main.getWorldPoint(p.x,p.y);}
  launch(level){
   const s=this.scene,p=s.player,t=this.target();if(!t||!Number.isFinite(t.x)||!Number.isFinite(t.y))return false;
   const dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy),scale=d>650?650/d:1;
   this.shells.push({x:p.x,y:p.y,tx:p.x+dx*scale,ty:p.y+dy*scale,age:0,duration:800,radius:100+Math.min(level-1,15)*12,damage:p.damage*(2+0.55*(level-1))});return true;
  }
  explode(shell){
   const s=this.scene;this.blasts.push({x:shell.tx,y:shell.ty,radius:shell.radius,age:0});
   for(const e of s.enemies.getChildren().slice()){
    if(!s.state.running)break;
    if(e.active&&Math.hypot(e.x-shell.tx,e.y-shell.ty)<=shell.radius+Math.min(e.displayWidth||40,e.displayHeight||40)*.35)this.damage(e,shell.damage);
   }
  }
  update(delta){
   const s=this.scene;if(!s.state.running||s.state.pausedForLevel||s.state.pausedForUser)return;
   const dt=Math.min(delta,100);this.clock+=dt;this.graphics.clear();const g=this.graphics,p=s.player;
   const cannon=p.cannonLevel||0,boomerang=p.boomerangLevel||0;
   if(cannon){this.cooldown-=dt;if(this.cooldown<=0&&this.launch(cannon))this.cooldown=Math.max(700,2800-(cannon-1)*180);}
   this.shells=this.shells.filter(shell=>{
    shell.age+=dt;const t=Math.min(1,shell.age/shell.duration);
    if(t>=1){this.explode(shell);return false;}
    const x=shell.x+(shell.tx-shell.x)*t,y=shell.y+(shell.ty-shell.y)*t;
    g.lineStyle(2,0xffbd62,.45).strokeCircle(shell.tx,shell.ty,shell.radius);
    g.fillStyle(0x182028,.25).fillEllipse(x,y,24,10);
    const height=4*150*t*(1-t);
    g.fillStyle(0xffb33d,1).fillCircle(x,y-height,12);
    g.lineStyle(3,0x704229,1).strokeCircle(x,y-height,12);
    g.fillStyle(0xfff1b1,1).fillCircle(x-3,y-height-4,4);return true;
   });
   this.blasts=this.blasts.filter(b=>{b.age+=dt;const t=b.age/400;if(t>=1)return false;g.fillStyle(0xff923f,(1-t)*.4).fillCircle(b.x,b.y,b.radius*(.5+t*.5));g.lineStyle(5,0xffdf8b,1-t).strokeCircle(b.x,b.y,b.radius*(.5+t*.5));return true;});
   if(boomerang){
    const count=Math.min(6,boomerang),radius=115;this.angle+=dt/1000*(2+Math.min(boomerang-1,15)*.18);
    const points=[];
    for(let i=0;i<count;i++){
     const a=this.angle+i*Math.PI*2/count,x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius,spin=this.angle*3;
     const point=(dx,dy)=>({x:x+dx*Math.cos(spin)-dy*Math.sin(spin),y:y+dx*Math.sin(spin)+dy*Math.cos(spin)});
     const left=point(-18,-10),mid=point(0,8),right=point(18,-10);
     g.lineStyle(10,0x794d2c,1).beginPath().moveTo(left.x,left.y).lineTo(mid.x,mid.y).lineTo(right.x,right.y).strokePath();
     g.lineStyle(5,0xffdc72,1).beginPath().moveTo(left.x,left.y).lineTo(mid.x,mid.y).lineTo(right.x,right.y).strokePath();points.push({x,y});
    }
    for(const e of s.enemies.getChildren().slice()){
     if(!s.state.running)break;if(!e.active||(this.hits.get(e)||0)>this.clock)continue;
     const hitRadius=22+Math.min(e.displayWidth||40,e.displayHeight||40)*.35;
     if(points.some(b=>Math.hypot(b.x-e.x,b.y-e.y)<=hitRadius)){this.hits.set(e,this.clock+400);this.damage(e,p.damage*(.8+(boomerang-1)*.25));}
    }
   }
  }
  destroy(){this.graphics.destroy();this.shells=[];this.blasts=[];}
 }
 window.BBOExtraWeapons=ExtraWeapons;
})();
