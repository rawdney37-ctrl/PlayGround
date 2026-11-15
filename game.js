(() => {
  'use strict';
  const canvas = document.getElementById('world'), ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const W = 2600, H = 2300;
  let vw = 0, vh = 0, dpr = 1, last = 0, running = false, now = 0;
  const rand = (() => { let s = 18481; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const player = {x:445,y:465,r:10,dir:0,hp:100,hunger:82,thirst:68,stamina:100,temp:36.8, attack:0, noise:0};
  let camera = {x:0,y:0};
  const input = {up:false,down:false,left:false,right:false,run:false};
  const buildings = [], trees = [], lootSpots = [], infected = [], props = [], discovered = new Set();
  const inventory = [
    {id:1,name:'Field knife',type:'gear',icon:'⌁',qty:1,weight:.4,desc:'A worn utility blade. Better than empty hands.',condition:68},
    {id:2,name:'Canned beans',type:'food',icon:'▤',qty:2,weight:.4,desc:'A dented tin. Not pretty, but it will keep you moving.',use:'eat'},
    {id:3,name:'Water bottle',type:'drink',icon:'◒',qty:1,weight:.6,desc:'A sealed bottle of clean water.',use:'drink'},
    {id:4,name:'Bandage',type:'medical',icon:'✚',qty:1,weight:.2,desc:'Sterile dressing. Stops bleeding and restores a little health.',use:'heal'},
  ];
  let selected = null, activeSlot = 1, currentTab = 'all', toastTimer = 0, cycle = 6.7, kills = 0;
  const itemCatalog = [
    {name:'Canned beans',type:'food',icon:'▤',weight:.4,desc:'A dented tin of beans. Restores hunger.',use:'eat'},
    {name:'Water bottle',type:'drink',icon:'◒',weight:.6,desc:'Clean water in a sealed plastic bottle.',use:'drink'},
    {name:'Bandage',type:'medical',icon:'✚',weight:.2,desc:'Sterile dressing. Restores health.',use:'heal'},
    {name:'Soda can',type:'drink',icon:'◉',weight:.4,desc:'Flat, sugary and still sealed. Better than nothing.',use:'drink'},
    {name:'Painkillers',type:'medical',icon:'⊞',weight:.1,desc:'A few tablets in a rattling blister pack.',use:'heal'},
    {name:'Dried meat',type:'food',icon:'⌁',weight:.3,desc:'Smoky, tough and calorie dense.',use:'eat'},
    {name:'Scrap metal',type:'gear',icon:'▰',weight:1.2,desc:'Useful salvage. Could be fashioned into something.'},
    {name:'Matches',type:'gear',icon:'♨',weight:.1,desc:'A dry box of matches. A small luxury.'},
    {name:'9mm rounds',type:'gear',icon:'▮',weight:.2,desc:'A handful of loose ammunition. Keep it for later.'},
  ];
  function resize(){dpr=Math.min(devicePixelRatio||1,2);vw=innerWidth;vh=innerHeight;canvas.width=Math.floor(vw*dpr);canvas.height=Math.floor(vh*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  addEventListener('resize',resize); resize();

  function building(x,y,w,h,kind,name,angle=0){buildings.push({x,y,w,h,kind,name,angle});}
  // A small but coherent slice of a much larger county.
  building(465,390,92,68,'house','PINE RIDGE · HOUSE 04'); building(632,317,82,62,'house','PINE RIDGE · HOUSE 07',-.04);
  building(744,500,118,77,'shop','PINE RIDGE GENERAL'); building(925,374,102,72,'house','PINE RIDGE · HOUSE 11');
  building(1074,515,88,67,'house','PINE RIDGE · HOUSE 14',.03); building(605,713,105,73,'clinic','COUNTY CLINIC');
  building(862,735,100,64,'house','PINE RIDGE · HOUSE 18'); building(1146,768,126,78,'barn','MILLER FARM · BARN');
  building(1332,706,90,67,'house','MILLER FARM · COTTAGE'); building(1663,362,105,72,'bunker','CHECKPOINT 04');
  building(1804,420,81,62,'bunker','GUARD POST'); building(2110,895,112,78,'house','RIVER CROSSING · CABIN');
  building(2030,1192,95,71,'house','SOUTH SHORE · CABIN'); building(1332,1455,124,80,'house','OLD MILL');
  building(660,1550,115,74,'house','PINE RIDGE · OUTPOST'); building(352,1336,90,68,'house','FOREST CABIN');
  // Paths, roads, and land marks use world coordinates.
  const roads = [ [[0,563],[260,558],[450,550],[690,560],[945,541],[1230,562],[1480,550],[1770,570],[2050,530],[2600,505]],
    [[836,0],[838,226],[823,398],[830,563],[848,775],[864,1030],[890,1270],[920,1530],[970,1810],[980,2300]],
    [[0,1074],[240,1052],[490,1060],[760,1080],[1010,1085],[1250,1064],[1490,1040],[1710,1060],[1940,1090],[2230,1100],[2600,1082]],
    [[1570,0],[1550,190],[1559,410],[1575,590],[1600,790],[1610,990],[1630,1210],[1600,1440],[1580,1670],[1570,1900],[1550,2300]] ];
  function pathLine(points, width, color){ctx.beginPath();points.forEach((p,i)=>{const x=p[0]-camera.x,y=p[1]-camera.y;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p.x-(a[0]+t*dx),p.y-(a[1]+t*dy));}
  const lakes=[{points:[[1900,1330],[1950,1280],[2020,1270],[2080,1300],[2110,1370],[2080,1430],[2000,1450],[1920,1410],[1880,1370]]},{points:[[300,1860],[370,1800],[480,1810],[550,1880],[520,1960],[430,1995],[340,1950],[290,1900]]}];
  function inLake(x,y){return lakes.some(l=>{let inside=false,ps=l.points;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;});}
  // Procedural forest, deliberately sparse around settlements and roads.
  for(let i=0;i<630;i++){let x=rand()*W,y=rand()*H;if(buildings.some(b=>Math.abs(x-b.x)<b.w*1.35&&Math.abs(y-b.y)<b.h*1.5))continue;if(inLake(x,y))continue;if(roads.some(line=>line.slice(1).some((p,j)=>pointSegmentDistance({x,y},line[j],p)<47)))continue;trees.push({x,y,r:9+rand()*12,tone:Math.floor(rand()*4),pine:rand()>.42});}
  for(let i=0;i<520;i++){let x=rand()*W,y=rand()*H;if(inLake(x,y))continue;props.push({x,y,r:rand()*1.5,color:['#81906d','#a1a077','#687a62','#9a8f69'][Math.floor(rand()*4)]});}
  const spotsData=[[495,400,'house'],[665,326,'house'],[770,505,'shop'],[945,380,'house'],[1090,522,'house'],[620,720,'clinic'],[875,740,'house'],[1170,775,'barn'],[1350,715,'house'],[1680,370,'military'],[1820,425,'military'],[2120,905,'house'],[2040,1200,'house'],[1345,1460,'house'],[674,1557,'house'],[360,1342,'house'],[840,1080,'road'],[1590,570,'road'],[1985,1360,'water'],[420,1880,'water']];
  const spotLoot=[['Canned beans','Water bottle'],['Bandage','Soda can'],['Canned beans','Dried meat','Water bottle'],['Matches','Canned beans'],['Soda can'],['Bandage','Painkillers'],['Dried meat'],['Scrap metal','Matches'],['Canned beans'],['9mm rounds','Bandage'],['9mm rounds'],['Water bottle','Dried meat'],['Matches'],['Scrap metal','Canned beans'],['Bandage'],['Water bottle'],['Soda can','Matches'],['9mm rounds'],['Water bottle'],['Water bottle']];
  spotsData.forEach((s,i)=>lootSpots.push({x:s[0],y:s[1],kind:s[2],name:buildings.find(b=>Math.hypot(b.x-s[0],b.y-s[1])<35)?.name||'ROAD CACHE',items:spotLoot[i].slice(),searched:false,found:false}));
  for(let i=0;i<23;i++){let angle=rand()*Math.PI*2,r=330+rand()*1100,x=player.x+Math.cos(angle)*r,y=player.y+Math.sin(angle)*r;if(x<30||x>W-30||y<30||y>H-30||inLake(x,y))continue;infected.push({x,y,homeX:x,homeY:y,dir:rand()*6.28,speed:14+rand()*8,state:'wander',alert:0,attack:0});}
  // Infected cluster at the main street and the checkpoint.
  [[900,570],[1040,586],[790,820],[1650,610],[1715,540],[1490,1150],[2160,1050]].forEach(([x,y])=>infected.push({x,y,homeX:x,homeY:y,dir:rand()*6.28,speed:17,state:'wander',alert:0,attack:0}));

  function worldPoint(x,y){return {x:x-camera.x,y:y-camera.y};}
  function drawTerrain(){
    ctx.fillStyle='#465342';ctx.fillRect(0,0,vw,vh);
    // broad soft patches of scrub make the ground feel varied without noisy detail
    for(let i=0;i<trees.length;i++){const t=trees[i],x=t.x-camera.x,y=t.y-camera.y;if(x<-40||y<-40||x>vw+40||y>vh+40)continue;ctx.fillStyle=i%2?'rgba(26,39,29,.10)':'rgba(172,158,111,.045)';ctx.beginPath();ctx.ellipse(x,y,28+(i%9)*3,15+(i%7)*2,0,0,Math.PI*2);ctx.fill();}
    for(const l of lakes){ctx.beginPath();l.points.forEach((p,i)=>{let x=p[0]-camera.x,y=p[1]-camera.y;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fillStyle='#435b5b';ctx.fill();ctx.strokeStyle='rgba(185,185,144,.4)';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='rgba(150,176,160,.25)';ctx.lineWidth=1;ctx.stroke();}
    roads.forEach((line,i)=>{pathLine(line, i<2?39:34,'#5a5a49');pathLine(line,i<2?29:25,'#746c56');pathLine(line,1,'rgba(207,187,133,.25)');});
    // little tire-worn paths leading through the pines
    pathLine([[442,469],[504,463],[578,474],[640,466]],5,'#77725a');
    for(const p of props){const x=p.x-camera.x,y=p.y-camera.y;if(x<0||y<0||x>vw||y>vh)continue;ctx.fillStyle=p.color;ctx.globalAlpha=.44;ctx.fillRect(x,y,1.3,1.3);ctx.globalAlpha=1;}
  }
  function drawBuilding(b){const x=b.x-camera.x,y=b.y-camera.y;if(x<-160||y<-140||x>vw+160||y>vh+140)return;ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);const w=b.w,h=b.h;
    ctx.fillStyle='rgba(12,17,13,.4)';ctx.fillRect(-w/2+8,-h/2+12,w,h);
    ctx.fillStyle=b.kind==='bunker'?'#67695a':'#777360';ctx.fillRect(-w/2,-h/2,w,h);
    ctx.fillStyle=b.kind==='bunker'?'#77796a':'#99927a';ctx.fillRect(-w/2+3,-h/2+3,w-6,h-6);
    ctx.fillStyle=b.kind==='shop'?'#5c5444':b.kind==='clinic'?'#66634f':b.kind==='barn'?'#735544':b.kind==='bunker'?'#53594e':'#625746';
    ctx.beginPath();ctx.moveTo(-w/2-5,-h/2+3);ctx.lineTo(0,-h/2-13);ctx.lineTo(w/2+6,-h/2+4);ctx.lineTo(w/2+5,h/2-2);ctx.lineTo(-w/2-5,h/2-2);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(215,206,173,.15)';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='rgba(25,33,29,.85)';ctx.fillRect(-w*.27,-h*.23,12,11);ctx.fillRect(w*.18,-h*.23,12,11);ctx.fillRect(-w*.27,h*.08,12,11);
    ctx.fillStyle='rgba(188,169,112,.7)';ctx.fillRect(-6,h/2-14,12,12);
    if(b.kind==='clinic'){ctx.fillStyle='#d2cdb9';ctx.fillRect(-3,-h/2-8,6,16);ctx.fillRect(-8,-h/2-3,16,6)}
    if(b.kind==='bunker'){ctx.fillStyle='#bd6357';ctx.fillRect(-w/2-4,-h/2+12,6,22)}
    ctx.restore();
  }
  function drawTree(t){const x=t.x-camera.x,y=t.y-camera.y;if(x<-38||y<-38||x>vw+38||y>vh+38)return;ctx.fillStyle='rgba(8,15,10,.36)';ctx.beginPath();ctx.ellipse(x+7,y+11,t.r*1.2,t.r*.67,-.25,0,Math.PI*2);ctx.fill();ctx.fillStyle='#494331';ctx.fillRect(x-2,y-1,4,10);
    const colors=t.pine?['#263b30','#304437','#3b4934','#354532']:['#324531','#40523a','#4a593d','#2d4033'];ctx.fillStyle=colors[t.tone];ctx.beginPath();ctx.arc(x,y,t.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(172,170,126,.13)';ctx.beginPath();ctx.arc(x-t.r*.28,y-t.r*.34,t.r*.48,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(18,30,22,.35)';ctx.lineWidth=1;ctx.stroke();}
  function drawLoot(s){if(s.searched)return;const x=s.x-camera.x,y=s.y-camera.y;if(x<-20||y<-20||x>vw+20||y>vh+20)return;ctx.fillStyle='rgba(214,192,118,.18)';ctx.beginPath();ctx.arc(x,y,15+Math.sin(now*3)*2,0,Math.PI*2);ctx.fill();ctx.fillStyle=s.kind==='water'?'#8fb3ad':'#d2c58f';ctx.fillRect(x-4,y-4,8,8);ctx.strokeStyle='rgba(241,231,185,.65)';ctx.strokeRect(x-5,y-5,10,10);}
  function drawInfected(z){const x=z.x-camera.x,y=z.y-camera.y;if(x<-30||y<-30||x>vw+30||y>vh+30)return;ctx.save();ctx.translate(x,y);ctx.rotate(z.dir);ctx.fillStyle='rgba(9,13,10,.4)';ctx.beginPath();ctx.ellipse(4,8,9,5,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#493f38';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-2,1);ctx.lineTo(-5,9);ctx.moveTo(3,1);ctx.lineTo(6,9);ctx.stroke();ctx.fillStyle=z.alert>0?'#ab6251':'#777568';ctx.beginPath();ctx.ellipse(0,0,6,9,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9b6955';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-1,-1);ctx.lineTo(-9,3);ctx.moveTo(3,-1);ctx.lineTo(9,1);ctx.stroke();ctx.fillStyle='#b17761';ctx.beginPath();ctx.arc(0,-7,4.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d9ae8a';ctx.fillRect(1,-8,1,1);ctx.restore();}
  function drawPlayer(){const x=player.x-camera.x,y=player.y-camera.y;ctx.save();ctx.translate(x,y);ctx.rotate(player.dir);ctx.fillStyle='rgba(5,9,7,.42)';ctx.beginPath();ctx.ellipse(3,7,11,7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#292f2b';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-3,4);ctx.lineTo(-5,10);ctx.moveTo(4,4);ctx.lineTo(6,10);ctx.stroke();ctx.fillStyle='#79806a';ctx.beginPath();ctx.ellipse(0,0,8,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b4a078';ctx.fillRect(-5,-2,10,4);ctx.fillStyle='#454a3d';ctx.beginPath();ctx.arc(0,-7,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d0b782';ctx.fillRect(-2,-11,5,3);ctx.restore();
    if(player.attack>0){ctx.strokeStyle=`rgba(223,211,162,${player.attack*2})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,30,-.8,.8);ctx.stroke();}}
  function drawWorld(){drawTerrain();trees.forEach(drawTree);buildings.forEach(drawBuilding);lootSpots.forEach(drawLoot);infected.forEach(drawInfected);drawPlayer();}
  function nearbyTarget(){let best=null,bestD=Infinity;for(const s of lootSpots){if(s.searched)continue;const d=dist(player,s);if(d<74&&d<bestD){best=s;bestD=d;}}return best;}

  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');toastTimer=2.1;}
  function addItem(name,quantity=1){let item=inventory.find(i=>i.name===name);if(!item){const d=itemCatalog.find(i=>i.name===name);if(!d)return;item={...d,id:Date.now()+Math.random(),qty:0};inventory.push(item);}item.qty+=quantity;}
  function interact(){const target=nearbyTarget();if(!target){toast('NOTHING USEFUL WITHIN REACH');return;}target.searched=true;discovered.add(target.name);
    if(target.kind==='water'){addItem('Water bottle',1);toast('FILLED A BOTTLE WITH CLEAN WATER');return;}
    if(!target.items.length){toast('PICKED CLEAN. MOVE ON.');return;}
    const item=target.items.shift();addItem(item);let extra='';if(target.items.length&&Math.random()<.35){const second=target.items.shift();addItem(second);extra=` + ${second.toUpperCase()}`;}toast(`FOUND ${item.toUpperCase()}${extra}`);renderInventory();
  }
  function useItem(item){if(!item)return;if(item.use==='eat'){if(player.hunger>=98){toast('YOU ARE NOT HUNGRY');return;}player.hunger=clamp(player.hunger+27,0,100);toast('ATE '+item.name.toUpperCase()+' · HUNGER RESTORED');}
    else if(item.use==='drink'){if(player.thirst>=98){toast('YOU ARE NOT THIRSTY');return;}player.thirst=clamp(player.thirst+34,0,100);toast('DRANK '+item.name.toUpperCase()+' · HYDRATION RESTORED');}
    else if(item.use==='heal'){if(player.hp>=100){toast('YOU ARE ALREADY IN GOOD SHAPE');return;}player.hp=clamp(player.hp+32,0,100);toast('PATCHED UP · HEALTH RESTORED');}
    else return;
    item.qty--;if(item.qty<=0)inventory.splice(inventory.indexOf(item),1);selected=null;updateHUD();renderInventory();}
  function performAttack(){if(!running)return;player.attack=.38;player.noise=.5;let hit=null,bd=42;for(const z of infected){let d=dist(player,z);if(d<bd){const a=Math.atan2(z.y-player.y,z.x-player.x);if(Math.abs(Math.atan2(Math.sin(a-player.dir),Math.cos(a-player.dir)))<1.35){hit=z;bd=d;}}}if(hit){infected.splice(infected.indexOf(hit),1);kills++;toast('INFECTED DOWN · KEEP MOVING');}else toast('KNIFE SWING · THE SOUND CARRIES');}
  function update(dt){if(!running)return;now+=dt;cycle=(cycle+dt*.055)%24;player.hunger=clamp(player.hunger-dt*.032,0,100);player.thirst=clamp(player.thirst-dt*.052,0,100);player.stamina=clamp(player.stamina+(input.run&&player.stamina>0?-dt*18:dt*13),0,100);player.attack=Math.max(0,player.attack-dt);player.noise=Math.max(0,player.noise-dt);
    if(player.hunger===0||player.thirst===0)player.hp=clamp(player.hp-dt*.7,0,100);
    const dx=(input.right?1:0)-(input.left?1:0),dy=(input.down?1:0)-(input.up?1:0),mag=Math.hypot(dx,dy);if(mag){player.dir=Math.atan2(dy,dx);const sprint=input.run&&player.stamina>0,speed=sprint?190:114;const nx=clamp(player.x+dx/mag*speed*dt,12,W-12),ny=clamp(player.y+dy/mag*speed*dt,12,H-12);if(!buildings.some(b=>Math.abs(nx-b.x)<b.w*.48+10&&Math.abs(ny-b.y)<b.h*.44+10)){player.x=nx;player.y=ny;}player.noise=sprint?.7:.15;}
    for(const z of infected){let d=dist(player,z);const sight=d<230,hearing=d<(player.noise>.45?300:player.noise>.1?80:0);if(sight||hearing){z.alert=2.4;z.state='chase';}else z.alert=Math.max(0,z.alert-dt);if(z.alert>0){z.dir=Math.atan2(player.y-z.y,player.x-z.x);if(d>20){const sp=z.speed*(d>140?1.12:.9);z.x+=Math.cos(z.dir)*sp*dt;z.y+=Math.sin(z.dir)*sp*dt;}else{z.attack-=dt;if(z.attack<=0){z.attack=1.5;player.hp=clamp(player.hp-8,0,100);toast('INFECTED HIT · BREAK CONTACT');}}}else{z.dir+=Math.sin(now*.5+z.homeX)*dt*.5;z.x+=Math.cos(z.dir)*z.speed*.32*dt;z.y+=Math.sin(z.dir)*z.speed*.32*dt;if(Math.hypot(z.x-z.homeX,z.y-z.homeY)>45)z.dir=Math.atan2(z.homeY-z.y,z.homeX-z.x);}}
    camera.x=clamp(player.x-vw*.5,0,Math.max(0,W-vw));camera.y=clamp(player.y-vh*.5,0,Math.max(0,H-vh));
    if(player.hp<=0){player.hp=0;running=false;toast('YOU DID NOT MAKE IT. RELOAD TO TRY AGAIN.');}
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
    updateHUD();
  }
  function updateHUD(){const set=(id,v)=>$(id).textContent=v;const bar=(id,v)=>$(id).style.width=`${v}%`;set('health-value',Math.round(player.hp));set('hunger-value',Math.round(player.hunger));set('thirst-value',Math.round(player.thirst));set('stamina-value',Math.round(player.stamina));bar('health-bar',player.hp);bar('hunger-bar',player.hunger);bar('thirst-bar',player.thirst);bar('stamina-bar',player.stamina);const hour=Math.floor(cycle),min=Math.floor((cycle-hour)*60);set('clock',`${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`);const day=Math.max(0,Math.sin((cycle-6)/24*Math.PI*2));const darkness=clamp((.36-day)*.56,0,.22);$('weather').textContent=cycle>19||cycle<5?'NIGHTFALL':'OVERCAST';$('infected-count').textContent=infected.filter(z=>dist(z,player)<350).length;set('coords',`N ${String(Math.floor(player.y/26)).padStart(2,'0')}° · E ${String(Math.floor(player.x/26)).padStart(2,'0')}°`);$('noise-level').textContent=player.noise>.5?'LOUD':player.noise>.1?'NOTICEABLE':'QUIET';$('noise-level').style.color=player.noise>.5?'#d5816d':'';
    const target=nearbyTarget(),hint=$('action-hint');hint.classList.toggle('inactive',!target);if(target){const type=target.kind==='water'?'FILL BOTTLE':target.kind==='road'?'SEARCH CACHE':`SEARCH ${target.name.split('·').pop().trim()}`;hint.innerHTML=`<kbd>E</kbd><span>${type}</span>`;}
    const count=infected.filter(z=>dist(z,player)<280).length;$('nearby-count').textContent=`${count} SIGNAL${count===1?'':'S'}`;$('nearby-list').innerHTML=count?infected.filter(z=>dist(z,player)<280).slice(0,3).map(z=>`<div class="nearby-item"><span>✣ INFECTED</span><small>${Math.round(dist(z,player))} M</small></div>`).join(''):'<div class="empty-nearby"><span>⌁</span> No points of interest</div>';
  }
  function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);drawWorld();const day=Math.max(0,Math.sin((cycle-6)/24*Math.PI*2)),night=clamp((.32-day)*.56,0,.24);if(night){ctx.fillStyle=`rgba(10,17,29,${night})`;ctx.fillRect(0,0,vw,vh);}const fog=ctx.createRadialGradient(vw*.5,vh*.5,Math.min(vw,vh)*.12,vw*.5,vh*.5,Math.max(vw,vh)*.68);fog.addColorStop(0,'rgba(195,194,163,0)');fog.addColorStop(1,'rgba(174,184,158,.13)');ctx.fillStyle=fog;ctx.fillRect(0,0,vw,vh);}
  function loop(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);

  function renderInventory(){const grid=$('item-grid'),items=inventory.filter(it=>it.qty>0).filter(it=>currentTab==='all'||(currentTab==='consumables'?['food','drink','medical'].includes(it.type):it.type==='gear'));$('item-count').textContent=inventory.reduce((a,i)=>a+i.qty,0);grid.innerHTML='';for(const it of items){const card=document.createElement('button');card.className='item-card'+(selected===it?' selected':'');card.innerHTML=`<span class="item-amount">×${it.qty}</span><span class="item-glyph">${it.icon}</span><span class="item-label">${it.name.toUpperCase()}</span>`;card.onclick=()=>{selected=it;renderInventory();};grid.append(card);}const weight=inventory.reduce((a,i)=>a+i.qty*i.weight,0);$('capacity-text').textContent=`${weight.toFixed(1)} / 24 KG`;$('capacity-bar').style.width=`${Math.min(100,weight/24*100)}%`;const detail=$('item-detail');if(!selected||!inventory.includes(selected)){detail.innerHTML='<div class="detail-empty">SELECT AN ITEM<br><span>to inspect or use it</span></div>';return;}detail.innerHTML=`<div class="detail-icon">${selected.icon}</div><div class="detail-name">${selected.name}</div><div class="detail-type">${selected.type.toUpperCase()} · ${selected.qty} IN PACK</div><p class="detail-desc">${selected.desc}</p><div class="detail-weight">WEIGHT &nbsp; ${selected.weight.toFixed(1)} KG / UNIT</div>${selected.use?'<button class="use-btn" id="use-item">USE ITEM</button>':''}`;if(selected.use)$('use-item').onclick=()=>useItem(selected);}
  function openInventory(){renderInventory();$('modal-backdrop').classList.remove('hidden');}
  function toggleMap(){const el=$('map-overlay');el.classList.toggle('hidden');if(!el.classList.contains('hidden'))drawMap();}
  function drawMap(){const c=$('map-canvas'),g=c.getContext('2d'),sx=c.width/W,sy=c.height/H;g.fillStyle='#394a3b';g.fillRect(0,0,c.width,c.height);for(const l of lakes){g.beginPath();l.points.forEach((p,i)=>i?g.lineTo(p[0]*sx,p[1]*sy):g.moveTo(p[0]*sx,p[1]*sy));g.closePath();g.fillStyle='#3b5a5d';g.fill();}for(const line of roads){g.beginPath();line.forEach((p,i)=>i?g.lineTo(p[0]*sx,p[1]*sy):g.moveTo(p[0]*sx,p[1]*sy));g.strokeStyle='#81765b';g.lineWidth=3;g.stroke();}buildings.forEach(b=>{g.fillStyle=b.kind==='bunker'?'#a56b58':'#c6c19a';g.fillRect((b.x-b.w/2)*sx,(b.y-b.h/2)*sy,b.w*sx,b.h*sy);});infected.forEach(z=>{if(dist(player,z)<450){g.fillStyle='#da7665';g.beginPath();g.arc(z.x*sx,z.y*sy,3,0,Math.PI*2);g.fill();}});g.fillStyle='#e3d69a';g.beginPath();g.arc(player.x*sx,player.y*sy,5,0,Math.PI*2);g.fill();g.strokeStyle='#e3d69a';g.beginPath();g.arc(player.x*sx,player.y*sy,10,0,Math.PI*2);g.stroke();}
  $('deploy').onclick=()=>{$('start-screen').classList.add('dismissed');running=true;toast('YOU ARE ALONE OUT HERE. STAY QUIET.');};
  $('close-modal').onclick=()=>$('modal-backdrop').classList.add('hidden');$('modal-backdrop').onclick=e=>{if(e.target===$('modal-backdrop'))$('modal-backdrop').classList.add('hidden');};
  $('map-toggle').onclick=toggleMap;document.querySelector('.map-close').onclick=toggleMap;
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{currentTab=t.dataset.tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));renderInventory();});
  addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();const k=e.key.toLowerCase();if(k==='w'||k==='arrowup')input.up=true;if(k==='s'||k==='arrowdown')input.down=true;if(k==='a'||k==='arrowleft')input.left=true;if(k==='d'||k==='arrowright')input.right=true;if(k==='shift')input.run=true;if(k==='e'&&!e.repeat)interact();if(k==='i'&&!e.repeat){$('modal-backdrop').classList.toggle('hidden');if(!$('modal-backdrop').classList.contains('hidden'))openInventory();}if(k==='m'&&!e.repeat)toggleMap();if(k==='escape'){if(!$('modal-backdrop').classList.contains('hidden'))$('modal-backdrop').classList.add('hidden');if(!$('map-overlay').classList.contains('hidden'))toggleMap();}if(k===' '&&!e.repeat)performAttack();if('1234'.includes(k)){activeSlot=Number(k);document.querySelectorAll('.quick-slot').forEach((el,i)=>el.classList.toggle('active',i+1===activeSlot));}});
  addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='w'||k==='arrowup')input.up=false;if(k==='s'||k==='arrowdown')input.down=false;if(k==='a'||k==='arrowleft')input.left=false;if(k==='d'||k==='arrowright')input.right=false;if(k==='shift')input.run=false;});
  document.querySelectorAll('.quick-slot').forEach((el,i)=>el.onclick=()=>{activeSlot=i+1;document.querySelectorAll('.quick-slot').forEach((x,j)=>x.classList.toggle('active',j===i));});
  $('mobile-use').onclick=interact;$('mobile-run').ontouchstart=e=>{e.preventDefault();input.run=true;};$('mobile-run').ontouchend=()=>input.run=false;
  document.querySelectorAll('.touch-pad button').forEach(btn=>{const dirs={up:'up',down:'down',left:'left',right:'right'},d=dirs[btn.dataset.dir];btn.addEventListener('pointerdown',e=>{e.preventDefault();input[d]=true;});['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,()=>input[d]=false));});
  function buildQuickbar(){const q=$('quickbar');q.innerHTML='';for(let i=1;i<=4;i++){const it=inventory[i-1];const el=document.createElement('div');el.className='quick-slot'+(i===activeSlot?' active':'');el.innerHTML=`<span class="slot-key">${i}</span><span class="slot-icon">${it?.icon||'·'}</span><span class="slot-count">${it?.qty||''}</span>`;q.append(el);}q.querySelectorAll('.quick-slot').forEach((el,i)=>el.onclick=()=>{activeSlot=i+1;document.querySelectorAll('.quick-slot').forEach((x,j)=>x.classList.toggle('active',j===i));});}
  // Keep the quick slots and hand condition synced with the actual pack.
  const oldUpdate=updateHUD;updateHUD=function(){oldUpdate();buildQuickbar();const it=inventory.find(i=>i.name==='Field knife');$('equip-condition').textContent=it?`WORN · ${it.condition}%`:'EMPTY';};
  updateHUD();
})();
