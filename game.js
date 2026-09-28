(() => {
  'use strict';

  const GAME_W = 1920;
  const GAME_H = 1080;
  // 화면에 보이는 영역과 별개로 실제 전투 맵은 4200×2400으로 확장합니다.
  const MAP_W = 4200;
  const MAP_H = 2400;
  const BASE_MAP_W = 3000;
  const BASE_MAP_H = 1800;
  const MAP_SX = MAP_W / BASE_MAP_W;
  const MAP_SY = MAP_H / BASE_MAP_H;
  const mapX = x => MAP_W / 2 + (x - BASE_MAP_W / 2) * MAP_SX;
  const mapY = y => MAP_H / 2 + (y - BASE_MAP_H / 2) * MAP_SY;
  const mapRect = (x, y, w, h) => new Phaser.Geom.Rectangle(
    mapX(x), mapY(y), w * MAP_SX, h * MAP_SY
  );
  const SURVIVAL_SECONDS = 1800;
  const STAGE_SECONDS = 300;
  const TOTAL_STAGES = 6;
  const DIFFICULTIES = {easy:1,normal:2,hard:3};

  const COLORS = {
    pink: 0xff3d93,
    pinkLight: 0xff9bcf,
    purple: 0x7954e9,
    green: 0x315f3a,
    green2: 0x3f7647,
    white: 0xffffff,
    ink: 0x241d29,
    red: 0xff536d,
    yellow: 0xffd45c,
    blue: 0x68a7ff,
    bat: 0x5d4a79
  };

  const UPGRADES = [
    { id:'power', title:'응원 파워', desc:'공격력 +20%', icon:'♡', apply:p => p.damage += Math.max(3, Math.round(p.damage * .2)) },
    { id:'speed', title:'뽀글스의 응원', desc:'이동속도 +12%', icon:'»', apply:p => p.moveSpeed *= 1.12 },
    { id:'rapid', title:'방송 텐션', desc:'공격속도 +18%', icon:'⚡', apply:p => p.fireDelay = Math.max(170, p.fireDelay * .82) },
    { id:'maxhp', title:'팬들의 사랑', desc:'최대 HP +25 / 회복', icon:'♥', apply:p => { p.maxHp += 25; p.hp = p.maxHp; } },
    { id:'magnet', title:'추억의 자석', desc:'경험치 획득 범위 +35%', icon:'✦', apply:p => p.pickupRadius *= 1.35 },
    { id:'multishot', title:'하트 발사', desc:'투사체 +1개', icon:'✧', apply:p => p.projectiles += 1 }
  ];

  class MenuScene extends Phaser.Scene {
    constructor() {
      super('MenuScene');
    }

    create() {
      document.body.classList.remove('game-playing');
      requestAnimationFrame(()=>this.scale.refresh());
      this.selectedDifficulty='easy';
      const topButton = document.getElementById('restartTop');
      if (topButton) { topButton.style.display = 'none'; topButton.onclick = null; }

      this.cameras.main.setBackgroundColor(0x120d18);

      // Full-screen menu backdrop.
      this.menuBackdrops=[
        this.add.rectangle(this.scale.width/2,this.scale.height/2,this.scale.width,this.scale.height,0x120d18),
        this.add.rectangle(this.scale.width/2,this.scale.height*.24,this.scale.width,this.scale.height*.48,0x29142a,.72),
        this.add.rectangle(this.scale.width/2,this.scale.height*.78,this.scale.width,this.scale.height*.44,0x172b1b,.9)
      ];

      const glow = this.add.graphics();
      for (let r=360;r>30;r-=28) {
        glow.fillStyle(0xff3d93, 0.008 + (360-r)/50000);
        glow.fillCircle(GAME_W/2, 220, r);
      }

      const stars = this.add.graphics();
      for (let i=0;i<130;i++) {
        const x=Phaser.Math.Between(0,GAME_W);
        const y=Phaser.Math.Between(0,GAME_H);
        const size=Phaser.Math.Between(1,3);
        stars.fillStyle(i%4===0?0xffb6d5:0xffffff, Phaser.Math.FloatBetween(.12,.5));
        stars.fillCircle(x,y,size);
      }

      // Soft drifting particles make the menu feel alive without external assets.
      this.menuParticles=[];
      for(let i=0;i<18;i++) {
        const p=this.add.circle(
          Phaser.Math.Between(20,GAME_W-20),
          Phaser.Math.Between(80,GAME_H-30),
          Phaser.Math.Between(2,6),
          i%2?0xff79b5:0x7954e9,
          .22
        );
        this.menuParticles.push(p);
        this.tweens.add({
          targets:p,
          y:p.y-Phaser.Math.Between(30,90),
          alpha:{from:.05,to:.35},
          duration:Phaser.Math.Between(1800,3200),
          yoyo:true,
          repeat:-1,
          ease:'Sine.inOut',
          delay:Phaser.Math.Between(0,1200)
        });
      }

      const menuStartIndex=this.children.list.length;
      const badge = this.add.rectangle(GAME_W/2, 185, 94, 94, 0xff3d93, 1)
        .setStrokeStyle(3, 0xffc1dd, .65);
      this.add.text(GAME_W/2,185,'뽀',{
        fontFamily:'Noto Sans KR',fontSize:'54px',fontStyle:'900',color:'#ffffff'
      }).setOrigin(.5);
      this.tweens.add({targets:badge,scale:1.04,duration:1200,yoyo:true,repeat:-1,ease:'Sine.inOut'});

      this.add.text(GAME_W/2, 285, '뽀린걸 생존전', {
        fontFamily:'Noto Sans KR', fontSize:'46px', fontStyle:'900', color:'#ffffff'
      }).setOrigin(.5);
      this.add.text(GAME_W/2, 334, '3000 DAYS SURVIVAL', {
        fontFamily:'Noto Sans KR', fontSize:'13px', fontStyle:'800', color:'#ff9dca', letterSpacing:4
      }).setOrigin(.5);
      this.add.text(GAME_W/2, 370, '끝없이 몰려오는 적을 물리치고 3000일을 기념하세요.', {
        fontFamily:'Noto Sans KR', fontSize:'13px', color:'#d9cbd8'
      }).setOrigin(.5);

      const difficultyButtons=[];
      const choices=[['easy','쉬움 ×1'],['normal','보통 ×2'],['hard','하드 ×3']];
      choices.forEach(([key,label],i)=>{
        const x=GAME_W/2+(i-1)*140;
        const bg=this.add.rectangle(x,415,126,40,0x241b2b,.98).setStrokeStyle(2,0x6d566c,.75)
          .setInteractive({useHandCursor:true});
        const text=this.add.text(x,415,label,{fontFamily:'Noto Sans KR',fontSize:'14px',fontStyle:'800',color:'#ffffff'}).setOrigin(.5);
        difficultyButtons.push({key,bg,text});
        bg.on('pointerdown',()=>{this.selectedDifficulty=key;refreshDifficulty();});
      });
      const refreshDifficulty=()=>difficultyButtons.forEach(({key,bg,text})=>{
        const selected=key===this.selectedDifficulty;
        bg.setFillStyle(selected?0xff3d93:0x241b2b,1).setStrokeStyle(2,selected?0xffc1dd:0x6d566c,.8);
        text.setColor(selected?'#ffffff':'#cbbfcd');
      });
      refreshDifficulty();
      this.createMenuButton(GAME_W/2, 485, 420, 72, '게임 시작', true, () => {
        this.scene.start('MainScene',{difficulty:this.selectedDifficulty});
      });

      this.createMenuButton(GAME_W/2-108, 575, 204, 58, '조작 방법', false, () => {
        this.showHowTo();
      });
      this.createMenuButton(GAME_W/2+108, 575, 204, 58, 'SOOP 연동', false, () => {
        this.showSoopConnect();
      });

      const home = this.add.text(GAME_W/2, 660, '← 뽀린걸 팬사이트로 돌아가기', {
        fontFamily:'Noto Sans KR',fontSize:'12px',fontStyle:'700',color:'#b9abb8'
      }).setOrigin(.5).setInteractive({useHandCursor:true});
      home.on('pointerover',()=>home.setColor('#ff9dca'));
      home.on('pointerout',()=>home.setColor('#b9abb8'));
      home.on('pointerdown',()=>{ window.location.href='index.html'; });

      const footer=this.add.text(GAME_W/2, 850, 'WASD / 방향키 이동 · 공격 자동 · 30분 생존 목표', {
        fontFamily:'Noto Sans KR',fontSize:'10px',color:'#8f858f'
      }).setOrigin(.5);
      this.menuForeground=this.children.list.slice(menuStartIndex).filter(o=>o!==footer);
      this.menuBaseY=new Map(this.menuForeground.map(o=>[o,o.y]));
      this.menuBaseX=new Map(this.menuForeground.map(o=>[o,o.x]));
      this.menuFooter=footer;
      this.layoutMenu();
      this.onMenuResize=()=>requestAnimationFrame(()=>this.layoutMenu());
      window.addEventListener('resize',this.onMenuResize);
      this.scale.on('resize',this.onMenuResize);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
        window.removeEventListener('resize',this.onMenuResize);
        this.scale.off('resize',this.onMenuResize);
      });
    }

    layoutMenu() {
      const container=document.getElementById('game-container');
      if(!container || !this.menuBaseY) return;
      const centerX=this.scale.width/2;
      const centerY=this.scale.height/2;
      const shiftY=centerY-415;
      const shiftX=centerX-GAME_W/2;
      this.menuForeground.forEach(o=>o.setPosition(this.menuBaseX.get(o)+shiftX,this.menuBaseY.get(o)+shiftY));
      this.menuFooter.setPosition(centerX,this.scale.height-28);
      this.menuBackdrops[0].setPosition(centerX,centerY).setSize(this.scale.width,this.scale.height);
      this.menuBackdrops[1].setPosition(centerX,this.scale.height*.24).setSize(this.scale.width,this.scale.height*.48);
      this.menuBackdrops[2].setPosition(centerX,this.scale.height*.78).setSize(this.scale.width,this.scale.height*.44);
    }

    createMenuButton(x,y,w,h,label,primary,onClick) {
      const bg=this.add.rectangle(x,y,w,h,primary?0xff3d93:0x241b2b,.98)
        .setStrokeStyle(2,primary?0xffa9cf:0x6d566c,.75)
        .setInteractive({useHandCursor:true});
      const text=this.add.text(x,y,label,{
        fontFamily:'Noto Sans KR',fontSize:primary?'18px':'13px',fontStyle:'800',color:'#ffffff'
      }).setOrigin(.5).setDepth(2);
      bg.on('pointerover',()=>{
        bg.setStrokeStyle(3,primary?0xffd2e4:0xff3d93,1);
        this.tweens.add({targets:[bg,text],scale:1.02,duration:100});
      });
      bg.on('pointerout',()=>{
        bg.setStrokeStyle(2,primary?0xffa9cf:0x6d566c,.75);
        this.tweens.add({targets:[bg,text],scale:1,duration:100});
      });
      bg.on('pointerdown',onClick);
      return {bg,text};
    }

    showSoopConnect() {
      const dialog=document.getElementById('soopConnectDialog');
      if(dialog && !dialog.open) dialog.showModal();
    }

    showHowTo() {
      if(this.howTo) return;

      // Keep every popup element inside one managed group so nothing remains
      // on the main menu after the popup is closed.
      const overlay=this.add.rectangle(this.scale.width/2,this.scale.height/2,this.scale.width,this.scale.height,0x08060b,.78)
        .setDepth(50).setInteractive();
      const boxW=700, boxH=500;
      const box=this.add.rectangle(this.scale.width/2,this.scale.height/2,boxW,boxH,0x211825,.99)
        .setStrokeStyle(2,0xff3d93,.65).setDepth(51);

      const title=this.add.text(this.scale.width/2,this.scale.height/2-175,'조작 방법',{
        fontFamily:'Noto Sans KR',fontSize:'27px',fontStyle:'900',color:'#ffffff'
      }).setOrigin(.5).setDepth(52);

      const body=this.add.text(this.scale.width/2,this.scale.height/2-25,
        '이동\nW A S D  /  방향키\n\n공격\n가장 가까운 적에게 자동 공격\n\n성장\n경험치를 모으면 레벨업 카드 3개 중 하나 선택\n\n목표\n30분 생존 · 5분마다 스테이지 상승 · 3분에 보스 출현',{
          fontFamily:'Noto Sans KR',fontSize:'13px',color:'#ddd1dc',align:'center',
          lineSpacing:8, wordWrap:{width:boxW-100,useAdvancedWrap:true}
        }).setOrigin(.5).setDepth(52);

      const close=this.add.text(this.scale.width/2,this.scale.height/2+150,'닫기',{
        fontFamily:'Noto Sans KR',fontSize:'13px',fontStyle:'800',color:'#ff9dca'
      }).setOrigin(.5).setInteractive({useHandCursor:true}).setDepth(52);
      close.on('pointerdown',()=>this.closeHowTo());

      // All elements are explicitly tracked and destroyed together.
      this.howTo={overlay,box,title,body,close};
    }

    closeHowTo() {
      if(!this.howTo) return;
      const popup=this.howTo;
      Object.keys(popup).forEach(key=>{
        const obj=popup[key];
        if(obj && typeof obj.destroy==='function') obj.destroy();
      });
      this.howTo=null;
    }
  }

  class MainScene extends Phaser.Scene {
    constructor() {
      super('MainScene');
      this.state = null;
    }

    init(data) {
      this.difficulty=Object.prototype.hasOwnProperty.call(DIFFICULTIES,data?.difficulty)?data.difficulty:'easy';
    }

    enemyStatMultiplier() {
      return DIFFICULTIES[this.difficulty] * Math.pow(1.1,this.state.stage-1);
    }

    advanceStage(stage) {
      this.state.stage=stage;
      this.enemies.children.iterate(enemy=>{
        if(!enemy || !enemy.active) return;
        enemy.maxHp=Math.round(enemy.maxHp*1.1);
        enemy.hp=Math.min(enemy.maxHp,Math.round(enemy.hp*1.1));
        enemy.damage=Math.round(enemy.damage*1.1*10)/10;
      });
      this.showBanner(`STAGE ${stage}`,`적의 공격력과 체력이 10% 증가했습니다`);
    }

    preload() {
      // 캐릭터 이미지는 assets/roguelike/characters/ 폴더의 파일로 교체할 수 있습니다.
      // PNG/JPG 모두 사용 가능하며, 아래 파일명을 그대로 덮어쓰면 됩니다.
      const configured = window.BBORINGIRL_CHARACTER_ASSETS || {};
      const assets = {
        enemy:'assets/roguelike/characters/enemy.png',
        bat:'assets/roguelike/characters/bat.png',
        elite:'assets/roguelike/characters/elite.png',
        boss:'assets/roguelike/characters/boss.png',
        ...configured,
        playerLeft:configured.playerLeft || 'assets/roguelike/characters/player_left.png',
        playerRight:configured.playerRight || 'assets/roguelike/characters/player_right.png'
      };
      Object.entries(assets).forEach(([key,path]) => {
        if(path) this.load.image(key, path + (path.includes('?')?'&':'?') + 'rev=14');
      });
    }

    create() {
      const topButton = document.getElementById('restartTop');
      if (topButton) {
        topButton.style.display = 'block';
        topButton.textContent = '☰ 메뉴';
      }
      document.body.classList.add('game-playing');
      const gameContainer=document.getElementById('game-container');
      // Force the CSS header removal to settle before Phaser measures its parent.
      gameContainer.getBoundingClientRect();
      this.scale.refresh();
      requestAnimationFrame(()=>requestAnimationFrame(()=>this.scale.refresh()));
      this.time.delayedCall(150,()=>this.scene.isActive()&&this.scale.refresh());
      this.containerObserver=new ResizeObserver(()=>requestAnimationFrame(()=>{
        if(this.scene.isActive()) this.scale.refresh();
      }));
      this.containerObserver.observe(gameContainer);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.containerObserver.disconnect());
      this.cameras.main.setBackgroundColor(0x2b5b36);
      document.getElementById('gameMenuButton').onclick=()=>this.scene.start('MenuScene');
      this.pauseButton=document.getElementById('gamePauseButton');
      this.pauseButton.onclick=()=>{
        if(!this.state.running || this.state.pausedForLevel) return;
        this.state.pausedForUser=!this.state.pausedForUser;
        this.syncPauseState();
      };
      this.resetState();
      this.createTextures();
      this.createWorld();
      this.createPlayer();
      this.createGroups();
      this.enemyHealthGraphics=this.add.graphics().setDepth(19);
      this.createInput();
      this.createUi();
      this.createCombatHud();
      this.createMobileControls();
      this.bindEvents();
      this.layoutHud();
      this.onHudResize=()=>requestAnimationFrame(()=>this.layoutHud());
      window.addEventListener('resize',this.onHudResize);
      this.scale.on('resize',this.onHudResize);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
        window.removeEventListener('resize',this.onHudResize);
        this.scale.off('resize',this.onHudResize);
      });

      this.spawnTimer = this.time.addEvent({
        delay: 900,
        loop: true,
        callback: this.spawnEnemy,
        callbackScope: this
      });

      this.attackTimer = this.time.addEvent({
        delay: 180,
        loop: true,
        callback: this.autoAttack,
        callbackScope: this
      });

      this.tickTimer = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: this.tickSecond,
        callbackScope: this
      });

      this.pauseNotice=document.getElementById('gamePauseNotice');
      this.syncPauseState();
      this.spawnInitialEnemies();
      this.updateUi();
    }

    resetState() {
      this.state = {
        running: true,
        elapsed: 0,
        kills: 0,
        wave: 1,
        stage: 1,
        bossRound: 0,
        bossActive: false,
        upgrades: {},
        level: 1,
        xp: 0,
        nextXp: 25,
        pausedForLevel: false,
        pausedForUser: false
      };
      this.physics.world.isPaused=false;
    }

    createTextures() {
      // 캐릭터 5종은 외부 이미지 파일을 사용합니다.
      // preload()에서 불러온 이미지가 없을 경우를 대비해 기존 도형 텍스처를 fallback으로 유지합니다.
      const make = (key, draw) => {
        if (this.textures.exists(key)) return;
        const g = this.make.graphics({x:0,y:0,add:false});
        draw(g);
        g.generateTexture(key, 64, 64);
        g.destroy();
      };

      const drawPlayer = g => {
        g.fillStyle(COLORS.pink, 1);
        g.fillCircle(32, 32, 22);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(24, 25, 6);
        g.fillCircle(40, 25, 6);
        g.fillStyle(COLORS.purple, 1);
        g.fillCircle(24, 26, 2);
        g.fillCircle(40, 26, 2);
        g.lineStyle(3, 0x8e1e60, 1);
        g.arc(32, 32, 10, .15, Math.PI-.15, false);
      };
      make('player', drawPlayer);
      make('playerLeft', drawPlayer);
      make('playerRight', drawPlayer);

      make('enemy', g => {
        g.fillStyle(0xb9d9c0, 1);
        g.fillCircle(32, 34, 20);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(25, 29, 5);
        g.fillCircle(39, 29, 5);
        g.fillStyle(0x3b4b40, 1);
        g.fillCircle(25, 30, 2);
        g.fillCircle(39, 30, 2);
      });

      make('bat', g => {
        g.fillStyle(COLORS.bat, 1);
        g.fillTriangle(8,34,25,20,27,43);
        g.fillTriangle(56,34,39,20,37,43);
        g.fillCircle(32, 34, 15);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(27,31,3);
        g.fillCircle(37,31,3);
      });

      make('elite', g => {
        g.fillStyle(0x7397c7, 1);
        g.fillCircle(32, 32, 24);
        g.lineStyle(4, 0xffffff, .7);
        g.strokeCircle(32,32,24);
      });

      make('boss', g => {
        g.fillStyle(0x8f315e, 1);
        g.fillCircle(32, 32, 29);
        g.fillStyle(0xff6aa8, 1);
        g.fillCircle(32, 32, 17);
        g.lineStyle(3, 0x351b32, 1);
        for (let i=0;i<8;i++) {
          const a=i*Math.PI/4;
          g.lineBetween(32+Math.cos(a)*15,32+Math.sin(a)*15,32+Math.cos(a)*28,32+Math.sin(a)*28);
        }
      });

      // 나머지 이펙트/아이템은 기존 코드 방식으로 생성합니다.
      make('orb', g => {
        g.fillStyle(COLORS.pink, 1);
        g.fillCircle(32,32,9);
        g.fillStyle(0xffffff, .8);
        g.fillCircle(29,29,3);
      });

      make('bullet', g => {
        g.fillStyle(0xffd6e8, 1);
        g.fillCircle(32,32,7);
        g.fillStyle(COLORS.pink, 1);
        g.fillCircle(32,32,4);
      });

      make('spark', g => {
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(32,3,39,27,61,32);
        g.fillTriangle(61,32,39,37,32,61);
        g.fillTriangle(32,61,25,37,3,32);
        g.fillTriangle(3,32,25,27,32,3);
      });

      make('tree', g => {
        g.fillStyle(0x6b432d, 1); g.fillRect(27, 36, 10, 22);
        g.fillStyle(0x214b2b, 1); g.fillCircle(32, 25, 18);
        g.fillStyle(0x2f6b3a, 1); g.fillCircle(20, 31, 13); g.fillCircle(44, 31, 13);
        g.fillStyle(0x4e8b4c, 1); g.fillCircle(30, 18, 8);
      });
      make('rock', g => {
        g.fillStyle(0x667277, 1); g.fillRoundedRect(10, 22, 44, 27, 8);
        g.fillStyle(0x879398, 1); g.fillTriangle(17, 25, 30, 12, 42, 25);
        g.fillStyle(0xb2b9bb, .55); g.fillCircle(25, 27, 5);
      });
      make('house', g => {
        g.fillStyle(0xb8755d, 1); g.fillRect(8, 24, 48, 32);
        g.fillStyle(0x7d3d43, 1); g.fillTriangle(4, 25, 32, 5, 60, 25);
        g.fillStyle(0x5a3a31, 1); g.fillRect(27, 38, 11, 18);
        g.fillStyle(0xaed0d9, 1); g.fillRect(15, 33, 9, 9); g.fillRect(40, 33, 9, 9);
      });
    }

    createWorld() {
      this.cameras.main.setBackgroundColor(0x1f4328);

      // 넓은 실제 전투 필드
      this.add.rectangle(MAP_W/2, MAP_H/2, MAP_W, MAP_H, 0x275633).setDepth(-20);

      const ground = this.add.graphics().setDepth(-19);
      ground.fillStyle(0x2b5b36, 1);
      ground.fillRect(0, 0, MAP_W, MAP_H);

      // 길: 중앙 광장 → 동/서/남/북으로 이어지는 비포장 도로
      const path = this.add.graphics().setDepth(-18);
      path.fillStyle(0x8c765c, 1);
      path.fillRect(MAP_W/2-92, 0, 184, MAP_H);
      path.fillRect(0, MAP_H/2-82, MAP_W, 164);
      path.fillCircle(MAP_W/2, MAP_H/2, 230);
      path.fillStyle(0x9c8669, .7);
      path.fillRect(MAP_W/2-58, 0, 116, MAP_H);
      path.fillRect(0, MAP_H/2-50, MAP_W, 100);

      // 물가/호수: 플레이어는 통과할 수 있지만 느려지는 지역
      this.waterZones = [
        mapRect(235, 180, 560, 250),
        mapRect(2110, 1120, 610, 310),
        mapRect(1180, 35, 410, 190),
        mapRect(90, 1380, 470, 250),
        mapRect(2550, 1350, 520, 260),
        mapRect(1180, 1510, 520, 210)
      ];
      const water = this.add.graphics().setDepth(-17);
      this.waterZones.forEach((r, idx) => {
        water.fillStyle(0x2f7890, .96); water.fillRoundedRect(r.x,r.y,r.width,r.height,38);
        water.lineStyle(5, 0x74b9c4, .55); water.strokeRoundedRect(r.x,r.y,r.width,r.height,38);
        for(let y=r.y+30;y<r.y+r.height-10;y+=34){
          for(let x=r.x+25;x<r.x+r.width-20;x+=95){
            water.lineStyle(2,0xb2e1df,.28);
            water.arc(x,y,16,Math.PI,Math.PI*2,false);
          }
        }
      });

      // 중앙 광장
      const plaza = this.add.graphics().setDepth(-16);
      plaza.fillStyle(0x9a8060, 1); plaza.fillCircle(MAP_W/2, MAP_H/2, 210);
      plaza.lineStyle(8,0xc1a27b,.55); plaza.strokeCircle(MAP_W/2,MAP_H/2,210);
      plaza.fillStyle(0x6c7b70,.9); plaza.fillCircle(MAP_W/2,MAP_H/2,72);
      plaza.fillStyle(0x9fb0a6,.7); plaza.fillCircle(MAP_W/2,MAP_H/2,48);

      // 잔디 디테일
      const grass = this.add.graphics().setDepth(-15);
      for (let i=0;i<1200;i++) {
        const x=Phaser.Math.Between(15,MAP_W-15), y=Phaser.Math.Between(15,MAP_H-15);
        let inWater=false; for(const r of this.waterZones){if(r.contains(x,y)){inWater=true;break;}}
        if(inWater) continue;
        grass.lineStyle(2, i%3===0?0x86b678:0x6f9e66, .25);
        grass.lineBetween(x,y,x+Phaser.Math.Between(-4,4),y-Phaser.Math.Between(4,10));
      }

      // 지도 위 실제 오브젝트. 중앙 길과 물을 피해 배치합니다.
      this.terrain = this.physics.add.staticGroup();
      const treeSpots = [
        [330,620],[480,760],[720,650],[920,920],[1160,690],[1430,760],[1710,600],[1980,760],[2280,620],[2630,760],
        [350,1330],[650,1190],[930,1450],[1370,1260],[1640,1450],[1960,1280],[2500,1500],[2750,1160],
        [1080,330],[1700,300],[2350,340],[2700,420]
      ];
      const rockSpots = [
        [260,540],[620,520],[820,1180],[1080,1120],[1520,520],[1840,1050],[2180,900],[2850,970],
        [480,1510],[1180,1540],[1770,1570],[2240,1550],[2720,1360]
      ];
      const houseSpots = [
        [430,300],[900,300],[2010,310],[2570,300],
        [430,1030],[830,1040],[2050,1010],[2570,1030],
        [520,1550],[1510,1510],[2390,1540]
      ];
      const addObstacle=(key,x,y,scale=1)=>{
        const o=this.terrain.create(x,y,key).setDepth(2).setScale(scale);
        o.refreshBody();
        // Obstacles are drawn on 64px textures; static bodies use world pixels.
        // Match the visible rock/house footprint after the sprite is scaled.
        const visible=key==='rock' ? {width:44,height:37}
          : key==='house' ? {width:56,height:51}
          : {width:38,height:34};
        o.body.setSize(key==='tree' ? visible.width : visible.width*scale,
          key==='tree' ? visible.height : visible.height*scale,true);
        return o;
      };
      treeSpots.forEach(([x,y],i)=>addObstacle('tree',mapX(x),mapY(y),.9+(i%3)*.08));
      rockSpots.forEach(([x,y],i)=>addObstacle('rock',mapX(x),mapY(y),.75+(i%2)*.15));
      houseSpots.forEach(([x,y])=>addObstacle('house',mapX(x),mapY(y),.95));

      // 확장된 4200×2400 전장을 채우는 추가 오브젝트. 기존 배치와 겹치지 않도록
      // 일정한 간격의 패턴으로 배치해 넓어진 맵에서도 빈 공간이 과도하게 남지 않게 합니다.
      const extraTreeSpots = [
        [120,520],[120,820],[120,1100],[120,1880],[120,2160],
        [600,220],[920,190],[1320,190],[1700,190],[2100,190],[2500,190],[2920,190],[3400,190],[3900,300],
        [600,2140],[1000,2220],[1450,2140],[1850,2220],[2300,2140],[2750,2220],[3200,2140],[3650,2220],[4050,2000],
        [4050,650],[4050,980],[4050,1320],[4050,1660]
      ];
      const extraRockSpots = [
        [360,180],[760,460],[1040,1880],[1450,420],[1860,1900],[2280,460],[2700,1850],[3150,460],[3550,1880],[3880,1120],
        [380,1980],[760,1560],[3460,1450],[3820,520]
      ];
      const extraHouseSpots = [
        [260,760],[820,480],[1160,2080],[1880,520],[2320,2040],[3050,520],[3500,2060],[3920,820],
        [300,1760],[980,1720],[3300,1720],[3900,1840]
      ];
      extraTreeSpots.forEach(([x,y],i)=>addObstacle('tree',x,y,.88+(i%3)*.07));
      extraRockSpots.forEach(([x,y],i)=>addObstacle('rock',x,y,.72+(i%2)*.12));
      extraHouseSpots.forEach(([x,y])=>addObstacle('house',x,y,.92));

      // 길 안내 표지와 지역명
      const labelStyle={fontFamily:'Noto Sans KR',fontSize:'12px',fontStyle:'800',color:'#f3e6d5',stroke:'#3c2c24',strokeThickness:4};
      this.add.text(MAP_W/2, MAP_H/2-125, '3000일 기념 중앙 광장', labelStyle).setOrigin(.5).setDepth(-10);
      this.add.text(mapX(430), mapY(455), '서쪽 호숫가', labelStyle).setOrigin(.5).setDepth(-10);
      this.add.text(mapX(2415), mapY(1480), '남동쪽 물가', labelStyle).setOrigin(.5).setDepth(-10);
      this.add.text(mapX(3300), mapY(500), '동쪽 숲길', labelStyle).setOrigin(.5).setDepth(-10);
      this.add.text(mapX(700), mapY(1900), '남서쪽 초원', labelStyle).setOrigin(.5).setDepth(-10);

      // 은은한 격자는 길/지형 위에서만 최소한으로 보이게 합니다.
      const grid=this.add.graphics().setDepth(-14);
      grid.lineStyle(1,0x6d9b68,.10);
      for(let x=0;x<=MAP_W;x+=100) grid.lineBetween(x,0,x,MAP_H);
      for(let y=0;y<=MAP_H;y+=100) grid.lineBetween(0,y,MAP_W,y);

      // ─────────────────────────────────────────────────────────────
      // 무한 맵 레이어
      // 현재 4200×2400 맵 한 장을 하나의 타일 텍스처로 굳힌 뒤
      // 주변 8장을 복제합니다. 플레이어는 맵 경계를 넘을 때 같은
      // 위치의 반대편으로 재배치되므로 화면에서는 맵 끝이 보이지 않습니다.
      // ─────────────────────────────────────────────────────────────
      this.createInfiniteMapLayer();

      this.worldBounds=new Phaser.Geom.Rectangle(-MAP_W+15,-MAP_H+15,MAP_W*3-30,MAP_H*3-30);
      this.physics.world.setBounds(-MAP_W,-MAP_H,MAP_W*3,MAP_H*3);
      // 무한 월드에서는 카메라의 유한 bounds를 사용하지 않습니다.
      this.cameras.main.removeBounds();
    }

    createInfiniteMapLayer() {
      // RenderTexture로 기존 월드 전체를 캡처하면 Phaser 버전에 따라 Graphics가
      // 잘리거나 좌표가 어긋나는 문제가 생길 수 있습니다. 그래서 배경은 별도의
      // Graphics 텍스처로 생성하고, 오브젝트는 실제 Sprite를 타일마다 복제합니다.
      const bg = this.add.graphics();
      bg.fillStyle(0x2b5b36, 1);
      bg.fillRect(0, 0, MAP_W, MAP_H);
      bg.fillStyle(0x8c765c, 1);
      bg.fillRect(MAP_W/2-92, 0, 184, MAP_H);
      bg.fillRect(0, MAP_H/2-82, MAP_W, 164);
      bg.fillCircle(MAP_W/2, MAP_H/2, 230);
      bg.fillStyle(0x9c8669, .7);
      bg.fillRect(MAP_W/2-58, 0, 116, MAP_H);
      bg.fillRect(0, MAP_H/2-50, MAP_W, 100);

      // 물은 맵의 가장자리에서 충분히 떨어뜨려 배치해 타일 경계에서 잘리지 않게 합니다.
      const safeWater = [
        mapRect(280, 220, 500, 220),
        mapRect(2130, 1160, 560, 270),
        mapRect(1220, 120, 360, 170),
        mapRect(150, 1430, 390, 210),
        mapRect(2640, 1390, 430, 220),
        mapRect(1230, 1580, 430, 180)
      ];
      this.waterZones = safeWater;
      safeWater.forEach(r => {
        bg.fillStyle(0x2f7890, .96);
        bg.fillRoundedRect(r.x,r.y,r.width,r.height,38);
        bg.lineStyle(5,0x74b9c4,.55);
        bg.strokeRoundedRect(r.x,r.y,r.width,r.height,38);
        for(let y=r.y+30;y<r.y+r.height-10;y+=34){
          for(let x=r.x+25;x<r.x+r.width-20;x+=95){
            bg.lineStyle(2,0xb2e1df,.28);
            bg.arc(x,y,16,Math.PI,Math.PI*2,false);
          }
        }
      });

      bg.fillStyle(0x9a8060, 1); bg.fillCircle(MAP_W/2, MAP_H/2, 210);
      bg.lineStyle(8,0xc1a27b,.55); bg.strokeCircle(MAP_W/2,MAP_H/2,210);
      bg.fillStyle(0x6c7b70,.9); bg.fillCircle(MAP_W/2,MAP_H/2,72);
      bg.fillStyle(0x9fb0a6,.7); bg.fillCircle(MAP_W/2,MAP_H/2,48);

      // 타일 가장자리까지 같은 방식으로 반복되므로 잔디 패턴도 타일마다 정확히 이어집니다.
      for (let i=0;i<900;i++) {
        const x=Phaser.Math.Between(20,MAP_W-20), y=Phaser.Math.Between(20,MAP_H-20);
        if (safeWater.some(r=>r.contains(x,y))) continue;
        bg.lineStyle(2, i%3===0?0x86b678:0x6f9e66, .25);
        bg.lineBetween(x,y,x+Phaser.Math.Between(-4,4),y-Phaser.Math.Between(4,10));
      }
      bg.lineStyle(1,0x6d9b68,.10);
      for(let x=0;x<=MAP_W;x+=100) bg.lineBetween(x,0,x,MAP_H);
      for(let y=0;y<=MAP_H;y+=100) bg.lineBetween(0,y,MAP_W,y);
      bg.generateTexture('bboringirl-infinite-map', MAP_W, MAP_H);
      bg.destroy();

      // 기존 월드 장식 Graphics/Text는 숨기고, 실제 Sprite 오브젝트만 타일마다 복제합니다.
      this.children.list.forEach(o => {
        if (o && o !== this.player && o !== this.terrain && o.setVisible &&
            o.depth < 0) o.setVisible(false);
      });

      const labelStyle={fontFamily:'Noto Sans KR',fontSize:'12px',fontStyle:'800',color:'#f3e6d5',stroke:'#3c2c24',strokeThickness:4};
      this.mapLabelData = [
        [MAP_W/2, MAP_H/2-125, '3000일 기념 중앙 광장'],
        [mapX(520), mapY(500), '서쪽 호숫가'],
        [mapX(2500), mapY(1500), '남동쪽 물가'],
        [mapX(3300), mapY(500), '동쪽 숲길'],
        [mapX(700), mapY(1900), '남서쪽 초원']
      ];

      const originals = this.terrain.getChildren().slice();
      originals.forEach(o => { o.setVisible(false); if(o.body) o.body.enable=false; });
      this.infiniteMapImages = [];
      this.terrainWrapObstacles = [];
      this.infiniteMapLabels = [];

      // 플레이어가 어느 타일에 있든 항상 주변 3×3 타일을 유지합니다.
      for (let ty=-1; ty<=1; ty++) {
        for (let tx=-1; tx<=1; tx++) {
          const image=this.add.image(MAP_W/2 + tx*MAP_W, MAP_H/2 + ty*MAP_H,
            'bboringirl-infinite-map').setOrigin(.5).setDepth(-30);
          this.infiniteMapImages.push({obj:image,tx,ty});
          for(const [lx,ly,text] of this.mapLabelData){
            const label=this.add.text(lx + tx*MAP_W, ly + ty*MAP_H, text, labelStyle)
              .setOrigin(.5).setDepth(-10);
            this.infiniteMapLabels.push({obj:label,tx,ty,lx,ly});
          }
        }
      }

      // 원본 장애물의 Sprite를 3×3으로 복제합니다. 이제 오브젝트가 RenderTexture에
      // 합쳐지지 않기 때문에 나무/바위/집이 흐려지거나 사라지지 않습니다.
      originals.forEach(original => {
        // 물 한가운데 놓인 기존 오브젝트는 타일 반복 때 잘려 보일 수 있으므로
        // 중심점이 물에 들어가는 오브젝트는 복제하지 않습니다.
        if(this.isInWater(original.x, original.y)) return;
        for(let ty=-1;ty<=1;ty++) for(let tx=-1;tx<=1;tx++) {
          const clone=this.terrain.create(original.x + tx*MAP_W, original.y + ty*MAP_H, original.texture.key);
          clone.setScale(original.scaleX, original.scaleY).setDepth(2).setVisible(true);
          clone.body.setSize(original.body.width, original.body.height, true);
          this.terrainWrapObstacles.push({obj:clone,tx,ty,baseX:original.x,baseY:original.y});
        }
      });
      this.infiniteTileX=0;
      this.infiniteTileY=0;
      this.updateInfiniteTiles(true);
    }

    updateInfiniteTiles(force=false) {
      if(!this.player || !this.infiniteMapImages) return;
      const tileX=Math.floor(this.player.x / MAP_W);
      const tileY=Math.floor(this.player.y / MAP_H);
      if(!force && tileX===this.infiniteTileX && tileY===this.infiniteTileY) return;
      this.infiniteTileX=tileX; this.infiniteTileY=tileY;
      this.infiniteMapImages.forEach(({obj,tx,ty})=>{
        obj.x=(tileX+tx)*MAP_W + MAP_W/2;
        obj.y=(tileY+ty)*MAP_H + MAP_H/2;
      });
      this.infiniteMapLabels.forEach(({obj,tx,ty,lx,ly})=>{
        obj.x=lx+(tileX+tx)*MAP_W;
        obj.y=ly+(tileY+ty)*MAP_H;
      });
      this.terrainWrapObstacles.forEach(({obj,tx,ty,baseX,baseY})=>{
        obj.x=baseX+(tileX+tx)*MAP_W;
        obj.y=baseY+(tileY+ty)*MAP_H;
        if(obj.body) obj.body.reset(obj.x,obj.y);
      });
    }

    wrapCoordinate(value, size) {
      return ((value % size) + size) % size;
    }

    isInWater(x, y) {
      const nx = this.wrapCoordinate(x, MAP_W);
      const ny = this.wrapCoordinate(y, MAP_H);
      for (const r of (this.waterZones || [])) {
        if (r.contains(nx, ny)) return true;
      }
      return false;
    }

    wrapInfiniteWorld() {
      if (!this.player) return;

      let shiftX = 0;
      let shiftY = 0;

      // 중앙 타일 [0..MAP_W) × [0..MAP_H)를 기준으로 좌표를 반복합니다.
      if (this.player.x < 0) shiftX = MAP_W;
      else if (this.player.x >= MAP_W) shiftX = -MAP_W;
      if (this.player.y < 0) shiftY = MAP_H;
      else if (this.player.y >= MAP_H) shiftY = -MAP_H;

      if (!shiftX && !shiftY) return;

      // 플레이어와 모든 동적 오브젝트를 같은 양만큼 이동시켜 상대적인 위치를 유지합니다.
      this.player.x += shiftX;
      this.player.y += shiftY;
      this.player.body.reset(this.player.x, this.player.y);

      const groups = [this.enemies, this.projectiles, this.xpOrbs];
      groups.forEach(group => {
        group?.children?.iterate(obj => {
          if (!obj || !obj.active) return;
          obj.x += shiftX;
          obj.y += shiftY;
          if (obj.body) obj.body.reset(obj.x, obj.y);
        });
      });
    }

    createGroups() {
      this.enemies = this.physics.add.group();
      this.projectiles = this.physics.add.group();
      this.xpOrbs = this.physics.add.group();

      this.physics.add.overlap(this.projectiles, this.enemies, this.hitEnemy, null, this);
      this.physics.add.overlap(this.player, this.enemies, this.playerHit, null, this);
      this.physics.add.overlap(this.player, this.xpOrbs, this.collectXp, null, this);
      // 나무/바위/건물은 실제 장애물로 작동합니다. 적은 장애물을 통과해 플레이어를 추적합니다.
      this.physics.add.collider(this.player, this.terrain);
    }

    configurePlayerHitbox() {
      // Arcade's circle and offsets are in source texture pixels, while the
      // character is rendered at 64px. Convert the intended 26px world hitbox.
      const radius=13;
      const sourceRadius=radius/Math.abs(this.player.scaleX);
      const offsetX=(this.player.width-sourceRadius*2)/2;
      const offsetY=(this.player.height-sourceRadius*2)/2+5/Math.abs(this.player.scaleY);
      this.player.body.setCircle(sourceRadius,offsetX,offsetY);
    }

    createPlayer() {
      this.player = this.physics.add.sprite(MAP_W/2, MAP_H/2, 'playerRight');
      this.player.setCollideWorldBounds(false);
      this.player.setDisplaySize(64,64);
      this.configurePlayerHitbox();
      this.player.moveSpeed = 250;
      this.player.body.setMaxVelocity(400, 400);
      this.player.damage = 18;
      this.player.fireDelay = 650;
      this.player.lastHit = 0;
      this.player.hp = 100;
      this.player.maxHp = 100;
      this.player.projectiles = 1;
      this.player.pickupRadius = 75;
      this.player.invulnerableUntil = 0;
      this.player.setDepth(20);

      // 화면이 플레이어를 따라가도록 해서 넓어진 맵을 실제로 탐험할 수 있게 합니다.
      // 플레이어가 화면 중심을 기준으로 실제 월드를 계속 이동합니다.
      // 맵 타일만 플레이어의 타일 좌표에 맞춰 뒤에서 교체하므로 카메라가 순간이동하지 않습니다.
      this.cameras.main.startFollow(this.player, false, 1, 1);
      this.cameras.main.setDeadzone(0, 0);
    }

    createInput() {
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    }

    createUi() {
      const style = {fontFamily:'Noto Sans KR', fontSize:'16px', fontStyle:'700', color:'#ffffff'};
      const small = {fontFamily:'Noto Sans KR', fontSize:'12px', color:'#e9dfe9'};

      this.ui = {
        top: this.add.rectangle(18,18,GAME_W-36,104,0x17121c,.82).setOrigin(0).setDepth(100),
        title: this.add.text(35,30,'뽀린걸 로그라이크',{...style,fontSize:'18px'}).setDepth(101),
        level: this.add.text(35,58,'LV 1',{...style,fontSize:'13px'}).setDepth(101),
        hpText: this.add.text(105,58,'HP 100 / 100',{...small}).setDepth(101),
        xpText: this.add.text(105,80,'EXP 0 / 25',{...small}).setDepth(101),
        time: this.add.text(GAME_W-38,32,'00:00',{...style,fontSize:'18px'}).setOrigin(1,0).setDepth(101),
        wave: this.add.text(GAME_W-38,58,'WAVE 1',{...small}).setOrigin(1,0).setDepth(101),
        kills: this.add.text(GAME_W-38,80,'KILLS 0',{...small}).setOrigin(1,0).setDepth(101),
        hpBg: this.add.rectangle(35,84,55,7,0x4a263a).setOrigin(0,.5).setDepth(101),
        hpBar: this.add.rectangle(35,84,55,7,COLORS.pink).setOrigin(0,.5).setDepth(102),
        xpBg: this.add.rectangle(105,98,520,6,0x4a263a).setOrigin(0,.5).setDepth(101),
        xpBar: this.add.rectangle(105,98,0,6,0xffb6d5).setOrigin(0,.5).setDepth(102),
        hint: this.add.text(GAME_W/2, GAME_H-18,'WASD / 방향키 이동 · 공격은 자동 · 레벨업 카드를 선택하세요',{...small,color:'#e6dce6'}).setOrigin(.5,1).setDepth(101)
      };
      Object.values(this.ui).forEach(o => o.setScrollFactor(0).setVisible(false));
    }

    createCombatHud() {
      const panel = this.add.rectangle(18, 122, 220, 235, 0x121820, .88)
        .setOrigin(0).setDepth(100).setStrokeStyle(1, 0x7d8d92, .35);
      const title = this.add.text(34, 138, '뽀린걸 생존 정보', {
        fontFamily:'Noto Sans KR', fontSize:'13px', fontStyle:'800', color:'#ffffff'
      }).setDepth(101);
      const sub = this.add.text(34, 160, 'SURVIVAL STATUS', {
        fontFamily:'Noto Sans KR', fontSize:'8px', color:'#91a0a5', letterSpacing:1
      }).setDepth(101);
      const hpBg = this.add.rectangle(34, 188, 180, 12, 0x422a38).setOrigin(0).setDepth(101);
      const hp = this.add.rectangle(34, 188, 180, 12, COLORS.pink).setOrigin(0).setDepth(102);
      const hpText = this.add.text(124, 194, '100 / 100', {
        fontFamily:'Noto Sans KR',fontSize:'9px',fontStyle:'800',color:'#ffffff'
      }).setOrigin(.5).setDepth(103);
      const labels = [
        ['공격력','18'],['공격속도','1.54/s'],['이동속도','250'],['흡수범위','75']
      ];
      const statTexts=[];
      const statLabels=[];
      labels.forEach((row,i)=>{
        const y=222+i*23;
        statLabels.push(this.add.text(35,y,row[0],{fontFamily:'Noto Sans KR',fontSize:'10px',color:'#9aa5a8'}).setDepth(101));
        statTexts.push(this.add.text(210,y,row[1],{fontFamily:'Noto Sans KR',fontSize:'10px',fontStyle:'800',color:'#ffffff'}).setOrigin(1,0).setDepth(101));
      });
      const passiveTitle=this.add.text(34,316,'패시브 효과',{fontFamily:'Noto Sans KR',fontSize:'10px',fontStyle:'800',color:'#ff9bc8'}).setDepth(101);
      const passive = this.add.text(34,335,'선택한 능력 없음',{fontFamily:'Noto Sans KR',fontSize:'9px',color:'#ddd1dc',lineSpacing:6}).setDepth(101);
      this.combatHud={panel,hp,hpText,statTexts,passive};

      this.bossBg=this.add.rectangle(GAME_W/2,122,520,13,0x311c2b,.92).setDepth(100).setVisible(false);
      this.bossBar=this.add.rectangle(GAME_W/2-260,122,520,13,0xff526e,.95).setOrigin(0,.5).setDepth(101).setVisible(false);
      this.bossText=this.add.text(GAME_W/2,101,'BOSS',{fontFamily:'Noto Sans KR',fontSize:'10px',fontStyle:'900',color:'#ffd6e4'}).setOrigin(.5).setDepth(101).setVisible(false);
      const combatItems=[panel,title,sub,hpBg,hp,hpText,...statLabels,...statTexts,passiveTitle,passive,this.bossBg,this.bossBar,this.bossText];
      combatItems.forEach(o => { o.setScrollFactor(0); if(o!==this.bossBg && o!==this.bossBar && o!==this.bossText) o.setVisible(false); });
      this.hudTopItems=[...Object.values(this.ui).filter(o=>o!==this.ui.hint),...combatItems];
      this.hudBaseY=new Map(this.hudTopItems.map(o=>[o,o.y]));
    }

    layoutHud() {
      if(!this.hudBaseY || !this.game.canvas) return;
      const container=document.getElementById('game-container');
      if(!container) return;
      const cropTop=0;
      const cropBottom=0;
      this.hudTopItems.forEach(o=>o.setY(this.hudBaseY.get(o)+cropTop));
      this.ui.hint.setY(this.scale.height-18-cropBottom);
      this.bossBg.setX(this.scale.width/2);
      this.bossBar.setX(this.scale.width/2-260);
      this.bossText.setX(this.scale.width/2);
    }

    createMobileControls() {
      this.joy={active:false,id:null,baseX:0,baseY:0,radius:56,dx:0,dy:0};
      this.joyGraphics=this.add.graphics().setDepth(110).setScrollFactor(0);
      this.layoutJoystick();
      this.onJoystickResize=()=>this.layoutJoystick();
      this.scale.on('resize',this.onJoystickResize);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.scale.off('resize',this.onJoystickResize));

      this.input.on('pointerdown', p => {
        if(!this.touchControlsEnabled) return;
        const distance=Math.hypot(p.x-this.joy.baseX,p.y-this.joy.baseY);
        if(distance>this.joy.radius*1.35) return;
        this.joy.active=true;
        this.joy.id=p.id;
        this.updateJoystick(p);
      });
      this.input.on('pointermove', p => {
        if(this.joy.active && p.id===this.joy.id) this.updateJoystick(p);
      });
      const release=p=>{
        if(this.joy.active && p.id===this.joy.id){
          this.joy.active=false;this.joy.id=null;
          this.joy.dx=0;this.joy.dy=0;
          this.drawJoystick();
        }
      };
      this.input.on('pointerup',release);
      this.input.on('pointerupoutside',release);
    }

    layoutJoystick() {
      this.touchControlsEnabled=window.matchMedia('(pointer: coarse)').matches ||
        (navigator.maxTouchPoints>0 && this.scale.width<=900);
      const radius=Math.max(48,Math.min(64,this.scale.width*.09));
      this.joy.radius=radius;
      this.joy.baseX=radius+24;
      this.joy.baseY=this.scale.height-radius-24;
      this.joyGraphics.setVisible(this.touchControlsEnabled);
      this.drawJoystick();
    }

    drawJoystick() {
      const g=this.joyGraphics;
      g.clear();
      if(!this.touchControlsEnabled) return;
      const {baseX,baseY,radius,dx,dy}=this.joy;
      g.fillStyle(0x101b20,.34).fillCircle(baseX,baseY,radius);
      g.lineStyle(2,0xffffff,.28).strokeCircle(baseX,baseY,radius);
      g.fillStyle(COLORS.pink,.82).fillCircle(baseX+dx*radius*.55,baseY+dy*radius*.55,Math.max(17,radius*.31));
    }

    updateJoystick(p) {
      const dx=p.x-this.joy.baseX,dy=p.y-this.joy.baseY;
      const len=Math.hypot(dx,dy);
      const amount=Math.min(1,len/this.joy.radius);
      const strength=amount<.12?0:(amount-.12)/.88;
      this.joy.dx=len?dx/len*strength:0;
      this.joy.dy=len?dy/len*strength:0;
      this.drawJoystick();
    }

    bindEvents() {
      const top = document.getElementById('restartTop');
      if (top) top.onclick = () => this.scene.start('MenuScene');
    }

    syncPauseState() {
      const paused=this.state.pausedForLevel || this.state.pausedForUser;
      this.physics.world.isPaused=paused;
      for(const timer of [this.spawnTimer,this.attackTimer,this.tickTimer]){
        if(timer) timer.paused=paused;
      }
      if(this.pauseButton){
        this.pauseButton.textContent=this.state.pausedForUser?'▶ 계속':'⏸ 일시정지';
        this.pauseButton.setAttribute('aria-pressed',String(this.state.pausedForUser));
        this.pauseButton.disabled=this.state.pausedForLevel || !this.state.running;
      }
      if(this.pauseNotice) this.pauseNotice.hidden=!this.state.pausedForUser;
    }

    spawnInitialEnemies() {
      for(let i=0;i<8;i++) this.spawnEnemy();
    }

    getSpawnPosition() {
      // 무한 맵에서는 화면 밖의 사방에서 적이 들어오는 방식으로 생성합니다.
      const angle=Phaser.Math.FloatBetween(0,Math.PI*2);
      const distance=Phaser.Math.Between(780,1050);
      return {
        x:this.player.x + Math.cos(angle)*distance,
        y:this.player.y + Math.sin(angle)*distance
      };
    }

    spawnEnemy() {
      if(!this.state.running || this.state.pausedForUser || this.state.pausedForLevel ||
         this.state.bossActive || this.state.elapsed>=SURVIVAL_SECONDS) return;
      const p=this.getSpawnPosition();
      const t=this.state.elapsed;
      let type='normal';
      const roll=Math.random();
      if(t>=120 && roll<.12) type='elite';
      else if(t>=45 && roll<.22) type='bat';

      let enemy=this.enemies.create(p.x,p.y,type==='elite'?'elite':type==='bat'?'bat':'enemy');
      enemy.type=type;
      enemy.setDepth(10);

      enemy.setDisplaySize(64,64);
      if(type==='elite'){
        enemy.maxHp=90+this.state.wave*15;
        enemy.hp=enemy.maxHp;
        enemy.speed=75+this.state.wave*3;
        enemy.damage=14;
        enemy.setDisplaySize(67.2,67.2);
      } else if(type==='bat'){
        enemy.maxHp=32+this.state.wave*5;
        enemy.hp=enemy.maxHp;
        enemy.speed=125+this.state.wave*4;
        enemy.damage=8;
      } else {
        enemy.maxHp=25+this.state.wave*5;
        enemy.hp=enemy.maxHp;
        enemy.speed=70+this.state.wave*4;
        enemy.damage=10;
      }
      const multiplier=this.enemyStatMultiplier();
      enemy.maxHp=Math.round(enemy.maxHp*multiplier);
      enemy.hp=enemy.maxHp;
      enemy.damage=Math.round(enemy.damage*multiplier*10)/10;
      enemy.lastHit=0;
      enemy.setCollideWorldBounds(false);
    }

    spawnBoss(round) {
      if(this.state.bossActive || round!==this.state.bossRound+1 || round>TOTAL_STAGES) return;
      this.state.bossRound=round;
      this.state.bossActive=true;
      const boss=this.enemies.create(this.player.x, this.player.y-650, 'boss');
      boss.type='boss';
      boss.bossRound=round;
      // Each five-minute boss grows from the previous boss, alongside stage/difficulty scaling.
      const multiplier=this.enemyStatMultiplier();
      boss.maxHp=Math.round(1800*Math.pow(1.5,round-1)*multiplier);
      boss.hp=boss.maxHp;
      boss.speed=48*Math.pow(1.25,round-1);
      boss.damage=Math.round(24*Math.pow(1.5,round-1)*multiplier*10)/10;
      boss.setDisplaySize(99.2,99.2);
      boss.setDepth(15);
      boss.setData('isBoss',true);
      this.showBanner(`BOSS ${round}/${TOTAL_STAGES} 출현!`, '보스를 쓰러뜨릴 때까지 시간이 멈춥니다');
      this.updateUi();
    }

    autoAttack() {
      if(!this.state.running || this.state.pausedForLevel || this.state.pausedForUser) return;
      const now=this.time.now;
      if(now-this.player.lastAttack < this.player.fireDelay) return;
      const target=this.getNearestEnemy();
      if(!target) return;

      this.player.lastAttack=now;
      const base=Phaser.Math.Angle.Between(this.player.x,this.player.y,target.x,target.y);
      const count=this.player.projectiles;
      const spread=count===1 ? 0 : .22;

      for(let i=0;i<count;i++){
        const offset=(i-(count-1)/2)*spread;
        const angle=base+offset;
        const bullet=this.projectiles.create(this.player.x,this.player.y,'bullet');
        bullet.setDepth(18);
        bullet.damage=this.player.damage;
        bullet.speed=470;
        bullet.life=1000;
        bullet.setVelocity(Math.cos(angle)*bullet.speed,Math.sin(angle)*bullet.speed);
        bullet.setScale(.65);
      }
    }

    getNearestEnemy() {
      let nearest=null, best=Infinity;
      this.enemies.children.iterate(e=>{
        if(!e || !e.active) return;
        const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,e.x,e.y);
        if(d<best){best=d;nearest=e;}
      });
      return nearest;
    }

    hitEnemy(bullet, enemy) {
      if(!bullet.active || !enemy.active) return;
      bullet.destroy();
      enemy.hp-=bullet.damage;
      enemy.setTint(0xffffff);
      this.time.delayedCall(70,()=>enemy.active&&enemy.clearTint());

      const spark=this.add.sprite(enemy.x,enemy.y,'spark').setScale(.28).setDepth(30);
      this.tweens.add({targets:spark,scale:.75,alpha:0,duration:180,onComplete:()=>spark.destroy()});

      if(enemy.hp<=0) this.killEnemy(enemy);
    }

    killEnemy(enemy) {
      const value=enemy.type==='boss'?40:enemy.type==='elite'?8:enemy.type==='bat'?3:2;
      this.state.kills++;
      if(enemy.type==='boss'){
        this.dropXp(enemy.x,enemy.y,value, true);
        this.state.bossActive=false;
        if(this.state.elapsed>=SURVIVAL_SECONDS && this.state.bossRound===TOTAL_STAGES){
          enemy.destroy();
          this.victory();
          return;
        }
        this.showBanner('보스 격파!', '시간이 다시 흐르고 적들이 등장합니다 ♡');
      } else {
        this.dropXp(enemy.x,enemy.y,value, false);
      }
      enemy.destroy();
      this.updateUi();
    }

    dropXp(x,y,value,big=false) {
      for(let i=0;i<value;i++){
        const orb=this.xpOrbs.create(
          x+Phaser.Math.Between(-18,18),
          y+Phaser.Math.Between(-18,18),
          'orb'
        );
        orb.xp=big?10:1;
        orb.setScale(big?.85:.42);
        orb.setDepth(8);
        orb.setVelocity(Phaser.Math.Between(-45,45),Phaser.Math.Between(-45,45));
        this.time.delayedCall(400,()=>orb.active&&orb.setVelocity(0,0));
      }
    }

    collectXp(player,orb) {
      if(!orb.active) return;
      const dist=Phaser.Math.Distance.Between(player.x,player.y,orb.x,orb.y);
      if(dist>player.pickupRadius) return;
      this.gainXp(orb.xp);
      orb.destroy();
    }

    gainXp(amount) {
      this.state.xp+=amount;
      if(!this.state.pausedForLevel && this.state.xp>=this.state.nextXp) this.openLevelUp();
      this.updateUi();
    }

    openLevelUp() {
      if(!this.state.running || this.state.pausedForLevel) return;
      this.state.pausedForLevel=true;
      this.syncPauseState();

      const overlay=this.add.rectangle(this.scale.width/2,this.scale.height/2,this.scale.width,this.scale.height,0x160e19,.76).setDepth(200).setScrollFactor(0);
      const title=this.add.text(this.scale.width/2,this.scale.height/2-240,'LEVEL UP!',{
        fontFamily:'Noto Sans KR',fontSize:'42px',fontStyle:'900',color:'#ffffff'
      }).setOrigin(.5).setDepth(201).setScrollFactor(0);
      const sub=this.add.text(this.scale.width/2,this.scale.height/2-190,'강화할 능력을 하나 선택하세요',{
        fontFamily:'Noto Sans KR',fontSize:'15px',color:'#f1e7ef'
      }).setOrigin(.5).setDepth(201).setScrollFactor(0);

      const choices=Phaser.Utils.Array.Shuffle([...UPGRADES]).slice(0,3);
      const cards=[];

      choices.forEach((u,i)=>{
        const x=this.scale.width/2-250+i*250;
        const bg=this.add.rectangle(x,this.scale.height/2+10,220,230,0x2b2131,.98).setStrokeStyle(2,0x8c5c80,.7).setDepth(201).setScrollFactor(0).setInteractive({useHandCursor:true});
        const icon=this.add.text(x,this.scale.height/2-45,u.icon,{fontSize:'34px',color:'#ff9bc7'}).setOrigin(.5).setDepth(202).setScrollFactor(0);
        const name=this.add.text(x,this.scale.height/2,u.title,{fontFamily:'Noto Sans KR',fontSize:'17px',fontStyle:'800',color:'#ffffff',align:'center',wordWrap:{width:190}}).setOrigin(.5).setDepth(202).setScrollFactor(0);
        const desc=this.add.text(x,this.scale.height/2+55,u.desc,{fontFamily:'Noto Sans KR',fontSize:'12px',color:'#d3c5d2',align:'center',wordWrap:{width:180}}).setOrigin(.5).setDepth(202).setScrollFactor(0);
        bg.on('pointerover',()=>bg.setStrokeStyle(3,COLORS.pink,1));
        bg.on('pointerout',()=>bg.setStrokeStyle(2,0x8c5c80,.7));
        bg.on('pointerdown',()=> {
          u.apply(this.player);
          this.state.upgrades[u.id]=(this.state.upgrades[u.id]||0)+1;
          cards.forEach(c=>c.destroy());
          overlay.destroy(); title.destroy(); sub.destroy();
          this.state.xp-=this.state.nextXp;
          this.state.level++;
          this.state.nextXp=Math.floor(this.state.nextXp*1.28+8);
          this.state.pausedForLevel=false;
          this.syncPauseState();
          this.updateUi();
          if(this.state.xp>=this.state.nextXp) this.openLevelUp();
        });
        cards.push(bg,icon,name,desc);
      });
    }

    playerHit(player,enemy) {
      if(!enemy.active || !this.state.running) return;
      const now=this.time.now;
      if(now<player.invulnerableUntil) return;

      player.invulnerableUntil=now+650;
      player.hp-=enemy.damage;
      player.setTint(0xffffff);
      this.time.delayedCall(120,()=>player.active&&player.clearTint());

      const push=Phaser.Math.Angle.Between(enemy.x,enemy.y,player.x,player.y);
      player.x += Math.cos(push)*28;
      player.y += Math.sin(push)*28;
      this.updateInfiniteTiles();

      if(player.hp<=0) this.gameOver();
      this.updateUi();
    }

    update(time,delta) {
      if(!this.state?.running || this.state.pausedForLevel || this.state.pausedForUser) return;

      let x=0,y=0;
      if(this.keys.A.isDown||this.keys.LEFT.isDown) x-=1;
      if(this.keys.D.isDown||this.keys.RIGHT.isDown) x+=1;
      if(this.keys.W.isDown||this.keys.UP.isDown) y-=1;
      if(this.keys.S.isDown||this.keys.DOWN.isDown) y+=1;

      if(this.joy?.active){
        x=this.joy.dx; y=this.joy.dy;
      }

      // Ignore tiny joystick drift so the character keeps its last facing direction.
      if(x < -0.15 && this.player.texture.key !== 'playerLeft') {
        this.player.setTexture('playerLeft').setDisplaySize(64,64);
        this.configurePlayerHitbox();
      } else if(x > 0.15 && this.player.texture.key !== 'playerRight') {
        this.player.setTexture('playerRight').setDisplaySize(64,64);
        this.configurePlayerHitbox();
      }

      const inWater=this.isInWater(this.player.x,this.player.y);
      const terrainSpeed=inWater ? this.player.moveSpeed*0.58 : this.player.moveSpeed;
      const inputLength=Math.hypot(x,y);
      // Keyboard diagonals keep the same total speed; joystick retains analog speed.
      const inputScale=inputLength > 1 ? 1/inputLength : 1;
      const targetX=x*inputScale*terrainSpeed;
      const targetY=y*inputScale*terrainSpeed;
      const dt=Math.min(delta,50)/1000;
      const response=inputLength > 0.03 ? 0.075 : 0.065;
      const blend=1-Math.exp(-dt/response);
      const velocity=this.player.body.velocity;
      let nextX=velocity.x+(targetX-velocity.x)*blend;
      let nextY=velocity.y+(targetY-velocity.y)*blend;
      if(inputLength <= 0.03 && Math.hypot(nextX,nextY) < 1){ nextX=0; nextY=0; }
      this.player.setVelocity(nextX,nextY);

      // 플레이어 좌표는 그대로 유지하고, 주변 맵 타일만 재배치합니다.
      // 따라서 카메라는 좌우뿐 아니라 상하/대각선으로도 실제 월드를 계속 이동합니다.
      this.updateInfiniteTiles();
      this.enemyHealthGraphics.clear();
      this.enemies.children.iterate(e=>{
        if(!e||!e.active||e.type==='boss') return;
        const width=48, height=5;
        const left=e.x-width/2, top=e.y-e.displayHeight/2-12;
        this.enemyHealthGraphics.fillStyle(0x271b28,.88).fillRect(left,top,width,height);
        this.enemyHealthGraphics.fillStyle(e.type==='elite'?0xff9d46:e.type==='bat'?0xb793ff:0xff5e82,1)
          .fillRect(left,top,width*Math.max(0,Math.min(1,e.hp/e.maxHp)),height);
      });

      this.enemies.children.iterate(e=>{
        if(!e||!e.active) return;
        const angle=Phaser.Math.Angle.Between(e.x,e.y,this.player.x,this.player.y);
        e.setVelocity(Math.cos(angle)*e.speed,Math.sin(angle)*e.speed);
      });

      this.projectiles.children.iterate(b=>{
        if(!b||!b.active) return;
        b.life-=delta;
        if(b.life<=0) b.destroy();
      });

      this.xpOrbs.children.iterate(o=>{
        if(!o||!o.active) return;
        const d=Phaser.Math.Distance.Between(o.x,o.y,this.player.x,this.player.y);
        if(d<this.player.pickupRadius){
          const a=Phaser.Math.Angle.Between(o.x,o.y,this.player.x,this.player.y);
          const speed=220+Math.max(0,(this.player.pickupRadius-d)*2);
          o.setVelocity(Math.cos(a)*speed,Math.sin(a)*speed);
        }
      });

    }

    tickSecond() {
      if(!this.state.running || this.state.pausedForLevel || this.state.pausedForUser || this.state.bossActive) return;
      if(this.state.elapsed>=SURVIVAL_SECONDS) return;
      this.state.elapsed++;
      this.state.wave=Math.min(10,1+Math.floor(this.state.elapsed/30));
      // Stage 6 starts at 25:00, and its boss arrives at 30:00.
      const nextStage=Math.min(TOTAL_STAGES,1+Math.floor(this.state.elapsed/STAGE_SECONDS));
      if(nextStage>this.state.stage && this.state.elapsed<SURVIVAL_SECONDS) this.advanceStage(nextStage);
      if(this.state.elapsed%STAGE_SECONDS===0) this.spawnBoss(this.state.elapsed/STAGE_SECONDS);
      this.updateUi();
    }

    updateUi() {
      if(!this.ui || !this.player) return;
      const seconds=this.state.elapsed;
      const mm=String(Math.floor(seconds/60)).padStart(2,'0');
      const ss=String(seconds%60).padStart(2,'0');
      this.ui.level.setText(`LV ${this.state.level}`);
      this.ui.hpText.setText(`HP ${Math.max(0,Math.ceil(this.player.hp))} / ${this.player.maxHp}`);
      const shownXp=Math.min(this.state.xp,this.state.nextXp);
      this.ui.xpText.setText(`EXP ${shownXp} / ${this.state.nextXp}`);
      this.ui.time.setText(`${mm}:${ss}`);
      this.ui.wave.setText(`STAGE ${this.state.stage}/${TOTAL_STAGES} · WAVE ${this.state.wave}`);
      this.ui.kills.setText(`KILLS ${this.state.kills}`);
      this.ui.hpBar.width=55*Math.max(0,this.player.hp/this.player.maxHp);
      this.ui.xpBar.width=520*Math.max(0,Math.min(1,shownXp/this.state.nextXp));
      const byId=id=>document.getElementById(id);
      const hpRatio=Math.max(0,Math.min(1,this.player.hp/this.player.maxHp));
      const xpRatio=Math.max(0,Math.min(1,shownXp/this.state.nextXp));
      byId('gameHp').textContent=`${Math.max(0,Math.ceil(this.player.hp))} / ${this.player.maxHp}`;
      byId('gameHpFill').style.width=`${hpRatio*100}%`;
      byId('gameXp').textContent=`EXP ${shownXp} / ${this.state.nextXp}`;
      byId('gameXpFill').style.width=`${xpRatio*100}%`;
      byId('gameXpTrack').setAttribute('aria-valuenow',String(shownXp));
      byId('gameXpTrack').setAttribute('aria-valuemax',String(this.state.nextXp));
      byId('gameLevel').textContent=`LV ${this.state.level}`;
      byId('gameTime').textContent=`${mm}:${ss}`;
      byId('gameWave').textContent=`STAGE ${this.state.stage}/${TOTAL_STAGES} · WAVE ${this.state.wave}`;
      byId('gameDifficulty').textContent={easy:'쉬움',normal:'보통',hard:'하드'}[this.difficulty];
      byId('gameKills').textContent=`KILLS ${this.state.kills}`;
      byId('gameDamage').textContent=String(Math.round(this.player.damage));
      byId('gameAttackSpeed').textContent=`${(1000/this.player.fireDelay).toFixed(2)}/s`;
      byId('gameMoveSpeed').textContent=String(Math.round(this.player.moveSpeed));
      byId('gamePickup').textContent=String(Math.round(this.player.pickupRadius));
      const passiveLines=UPGRADES.filter(u=>this.state.upgrades[u.id])
        .map(u=>`${u.icon} ${u.title} ×${this.state.upgrades[u.id]}`);
      byId('gamePassives').textContent=passiveLines.length?passiveLines.join('\n'):'선택한 능력 없음';
      const bossStatus=byId('gameBossStatus');
      bossStatus.hidden=!this.state.bossActive;
      bossStatus.textContent=this.state.bossActive
        ? `BOSS ${this.state.bossRound}/${TOTAL_STAGES} · 시간 정지` : '';
      if(this.combatHud){
        this.combatHud.hp.width=180*Math.max(0,this.player.hp/this.player.maxHp);
        this.combatHud.hpText.setText(`${Math.max(0,Math.ceil(this.player.hp))} / ${this.player.maxHp}`);
        this.combatHud.statTexts[0].setText(String(Math.round(this.player.damage)));
        this.combatHud.statTexts[1].setText(`${(1000/this.player.fireDelay).toFixed(2)}/s`);
        this.combatHud.statTexts[2].setText(String(Math.round(this.player.moveSpeed)));
        this.combatHud.statTexts[3].setText(String(Math.round(this.player.pickupRadius)));
        this.combatHud.passive.setText(passiveLines.length?passiveLines.join('\n'):'선택한 능력 없음');
      }
      if(this.bossBar){
        let boss=null; this.enemies.children.iterate(e=>{if(e&&e.active&&e.type==='boss') boss=e;});
        const visible=Boolean(boss);
        this.bossBg.setVisible(visible); this.bossBar.setVisible(visible); this.bossText.setVisible(visible);
        if(boss){ this.bossBar.width=520*Math.max(0,boss.hp/boss.maxHp); this.bossText.setText(`BOSS ${boss.bossRound}/${TOTAL_STAGES} · ${Math.max(0,Math.ceil(boss.hp))} / ${boss.maxHp}`); }
      }
    }

    showBanner(title,sub) {
      const box=this.add.rectangle(this.scale.width/2,155,420,95,0x241727,.92).setStrokeStyle(2,COLORS.pink,.8).setDepth(150).setScrollFactor(0);
      const t=this.add.text(this.scale.width/2,138,title,{fontFamily:'Noto Sans KR',fontSize:'27px',fontStyle:'900',color:'#ffffff'}).setOrigin(.5).setDepth(151).setScrollFactor(0);
      const s=this.add.text(this.scale.width/2,174,sub,{fontFamily:'Noto Sans KR',fontSize:'11px',color:'#f3dce9'}).setOrigin(.5).setDepth(151).setScrollFactor(0);
      this.tweens.add({targets:[box,t,s],alpha:0,duration:2600,delay:700,onComplete:()=>[box,t,s].forEach(o=>o.destroy())});
    }

    gameOver() {
      if(!this.state.running) return;
      this.state.running=false;
      this.syncPauseState();
      this.spawnTimer?.remove();
      this.attackTimer?.remove();
      this.physics.world.isPaused=true;

      const overlay=this.add.rectangle(this.scale.width/2,this.scale.height/2,this.scale.width,this.scale.height,0x100b13,.78).setDepth(300).setScrollFactor(0);
      this.add.text(this.scale.width/2,this.scale.height/2-120,'GAME OVER',{
        fontFamily:'Noto Sans KR',fontSize:'52px',fontStyle:'900',color:'#ffffff'
      }).setOrigin(.5).setDepth(301).setScrollFactor(0);
      this.add.text(this.scale.width/2,this.scale.height/2-50,`생존 ${Math.floor(this.state.elapsed/60)}분 ${this.state.elapsed%60}초 · 처치 ${this.state.kills}마리`,{
        fontFamily:'Noto Sans KR',fontSize:'15px',color:'#e8dce7'
      }).setOrigin(.5).setDepth(301).setScrollFactor(0);
      this.add.text(this.scale.width/2,this.scale.height/2+20,'화면을 클릭하면 다시 시작',{
        fontFamily:'Noto Sans KR',fontSize:'14px',fontStyle:'800',color:'#ff9dca'
      }).setOrigin(.5).setDepth(301).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.scene.restart({difficulty:this.difficulty}));
    }

    victory() {
      if(!this.state.running) return;
      this.state.running=false;
      this.syncPauseState();
      this.spawnTimer?.remove();
      this.attackTimer?.remove();
      this.physics.world.isPaused=true;

      const overlay=this.add.rectangle(this.scale.width/2,this.scale.height/2,this.scale.width,this.scale.height,0x180f1b,.8).setDepth(300).setScrollFactor(0);
      this.add.text(this.scale.width/2,this.scale.height/2-120,'3000 DAYS CLEAR!',{
        fontFamily:'Noto Sans KR',fontSize:'46px',fontStyle:'900',color:'#ffffff'
      }).setOrigin(.5).setDepth(301).setScrollFactor(0);
      this.add.text(this.scale.width/2,this.scale.height/2-50,'30분 생존 · 보스 6명 격파 · 6스테이지 클리어! ♡',{
        fontFamily:'Noto Sans KR',fontSize:'17px',color:'#ffd5e7'
      }).setOrigin(.5).setDepth(301).setScrollFactor(0);
      this.add.text(this.scale.width/2,this.scale.height/2-5,`LV ${this.state.level} · 처치 ${this.state.kills}마리`,{
        fontFamily:'Noto Sans KR',fontSize:'13px',color:'#e6dce6'
      }).setOrigin(.5).setDepth(301).setScrollFactor(0);
      this.add.text(this.scale.width/2,this.scale.height/2+65,'화면을 클릭하면 다시 플레이',{
        fontFamily:'Noto Sans KR',fontSize:'14px',fontStyle:'800',color:'#ff9dca'
      }).setOrigin(.5).setDepth(301).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.scene.restart({difficulty:this.difficulty}));
    }
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#1f4328',
    scale: {
      // 중요: width/height는 '브라우저 크기'가 아니라 게임의 기준 좌표계입니다.
      // 캔버스를 부모 영역 크기로 조정해 화면 비율이 달라도 맵을 자르지 않습니다.
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: GAME_W,
      height: GAME_H,
      expandParent: false
    },
    render: {
      antialias: true,
      pixelArt: false
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: {x:0,y:0},
        // Update motion at render cadence to avoid uneven fixed-step sprite positions.
        fixedStep: false,
        debug: false
      }
    },
    scene: [MenuScene, MainScene]
  };

  window.addEventListener('load', () => {
    window.bboringirlGame = new Phaser.Game(config);
  });
})();
