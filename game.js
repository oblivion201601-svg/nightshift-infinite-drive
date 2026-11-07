/* NIGHTSHIFT - a self-contained WebGL driving game. No external JS libraries. */
(()=>{'use strict';
const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mix=(a,b,t)=>a+(b-a)*t, TAU=Math.PI*2;
const seedHash=(n)=>{let x=Math.sin(n*127.1+78.233)*43758.5453123;return x-Math.floor(x)};
const money=n=>Math.floor(n).toLocaleString('en-US');
const CARS=[
 {name:'Courier X',kind:'hatch',color:'#70e5d2',speed:117,accel:6.0,handle:.74,brake:13,grip:.88,price:0,description:'Your first set of keys. Forgiving, light and built for learning the road.'},
 {name:'Streetline 88',kind:'sedan',color:'#70b7ee',speed:125,accel:6.4,handle:.78,brake:13.4,grip:.90,price:1100,description:'Smooth four-door cruiser with stable steering and easy lane changes.'},
 {name:'Kestrel GT',kind:'coupe',color:'#e8a86a',speed:138,accel:7.2,handle:.84,brake:14.4,grip:.91,price:2800,description:'Low roof, sharp nose, and just enough power to start chaining passes.'},
 {name:'Mariner LX',kind:'suv',color:'#a7b4d7',speed:122,accel:6.6,handle:.66,brake:14.2,grip:.99,price:4500,description:'A solid SUV with excellent stopping confidence but slower turns.'},
 {name:'Riot Mini',kind:'hatch',color:'#f9df79',speed:131,accel:8.0,handle:.96,brake:14.7,grip:.93,price:7000,description:'Tiny footprint and very fast turn-in: a traffic-weaving specialist.'},
 {name:'Talon S',kind:'sport',color:'#ea7486',speed:151,accel:8.5,handle:.90,brake:16.8,grip:.86,price:10500,description:'An approachable sports car that rewards clean entries into bends.'},
 {name:'Granite 4×4',kind:'truck',color:'#82be9b',speed:126,accel:7.0,handle:.65,brake:15.2,grip:1.08,price:16000,description:'High-riding, stable and at home on dirt. More weight, more momentum.'},
 {name:'Fable RS',kind:'coupe',color:'#b290ec',speed:158,accel:9.1,handle:.90,brake:17.1,grip:.82,price:23500,description:'Strong launch, deliberate oversteer and serious drift potential.'},
 {name:'Vortex R',kind:'sport',color:'#49dce5',speed:169,accel:9.6,handle:.95,brake:18.5,grip:.91,price:34000,description:'A balanced highway weapon built for rapid direction changes.'},
 {name:'Barricade V8',kind:'muscle',color:'#f0a163',speed:166,accel:10.0,handle:.68,brake:15.3,grip:.69,price:46000,description:'Raw torque, heavy nose, loose tail. Master the drift, not the grip.'},
 {name:'Nightingale',kind:'luxury',color:'#f7f5ed',speed:164,accel:8.9,handle:.83,brake:19.3,grip:1.05,price:62000,description:'High-speed grand touring with quiet precision and excellent brakes.'},
 {name:'Phantom ZX',kind:'sport',color:'#da74d7',speed:182,accel:10.9,handle:.92,brake:20.1,grip:.86,price:82500,description:'A pure-bred speed machine; control its power, reap the rewards.'},
 {name:'Foxfire Turbo',kind:'rally',color:'#f3d05b',speed:158,accel:11.0,handle:1.06,brake:19.8,grip:1.03,price:109000,description:'Rally suspension gives extra control on shoulders and jump landings.'},
 {name:'Shogun K',kind:'coupe',color:'#ed6b66',speed:177,accel:11.5,handle:1.00,brake:21.3,grip:.78,price:138000,description:'A precise rear-drive coupe made for huge drift chains.'},
 {name:'Specter X',kind:'super',color:'#a2fcad',speed:197,accel:12.0,handle:1.03,brake:22.5,grip:1.10,price:177000,description:'An aerodynamic exotic with race-car grip and supercar acceleration.'},
 {name:'Ironclad R',kind:'muscle',color:'#d99c66',speed:190,accel:12.8,handle:.72,brake:20.5,grip:.67,price:226000,description:'The ultimate high-horsepower brute. Fast, loud, and sideways.'},
 {name:'Apex One',kind:'hyper',color:'#8dc2ff',speed:215,accel:13.9,handle:1.08,brake:23.5,grip:1.10,price:300000,description:'The first step into hypercars: instant response and enormous top speed.'},
 {name:'Nova EV',kind:'electric',color:'#daabff',speed:203,accel:15.2,handle:1.02,brake:23.8,grip:1.13,price:395000,description:'All-electric torque with explosive acceleration and poised handling.'},
 {name:'Obsidian 9',kind:'hyper',color:'#a4b5c9',speed:231,accel:15.0,handle:1.11,brake:25.0,grip:1.15,price:550000,description:'Near-unlimited highway pace with narrow margins for error.'},
 {name:'Zenith R',kind:'hyper',color:'#58ffe0',speed:250,accel:16.8,handle:1.18,brake:27.0,grip:1.20,price:800000,description:'The crown jewel of the garage. Unmatched acceleration and speed.'}
];
const saveKey='nightshift-infinite-drive-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(saveKey)||'{}')}catch{}
const state={credits:Math.max(0,Number(saved.credits)||0),unlocked:Array.isArray(saved.unlocked)?saved.unlocked.filter(v=>Number.isInteger(v)&&v>=0&&v<20):[0],carId:clamp(Number(saved.carId)||0,0,19),distance:Math.max(0,Number(saved.distance)||0),steerMode:saved.steerMode||'arrows',prefs:{assist:true,traffic:.75,quality:'medium',audio:false,unit:'mph',mobile:false,...saved.prefs},playing:false,modal:'menu',room:null,ws:null,myId:null,remote:new Map(),connected:false};
if(!state.unlocked.includes(0))state.unlocked.push(0);if(!state.unlocked.includes(state.carId))state.carId=0;
function save(){try{localStorage.setItem(saveKey,JSON.stringify({credits:state.credits,unlocked:state.unlocked,carId:state.carId,distance:state.distance,steerMode:state.steerMode,prefs:state.prefs}))}catch{}}
const player={x:0,z:0,y:0,yaw:0,vx:0,vz:0,speed:0,vy:0,grounded:true,onRamp:false,airTime:0,driftTime:0,driftPay:0,lastCrash:0,lastWeave:0,lastSide:0,lastNear:0,chain:0,chainAge:100,chainPoints:0};
const roadX=z=>Math.sin(z*.0048)*28+Math.sin(z*.014)*6.5+Math.sin(z*.0011)*38;
const roadY=z=>Math.sin(z*.014)*2.8+Math.sin(z*.006)*4+Math.sin(z*.043)*.48;
const roadSlope=z=>(roadX(z+1)-roadX(z-1))*.5;
const ROAD_HALF=11.5,LANES=[-8.5,-2.85,2.85,8.5];
function rampAt(z,x){const n=Math.floor((z-330)/720);for(let d=-1;d<=1;d++){const start=(n+d)*720+330,end=start+25;if(z>=start&&z<=end){const offset=(n+d)%2===0?2.85:-2.85;if(Math.abs(x-roadX(z)-offset)<2.6)return{height:roadY(z)+.285*(z-start),end,side:offset};}}return null}
function roadHeightAt(x,z){const ramp=rampAt(z,x);return ramp?ramp.height:roadY(z)}
player.x=roadX(0)+2.85;player.y=roadY(0)+.7;
const isCoarse=()=>window.matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
const touch={left:false,right:false,throttle:false,brake:false,drift:false,wheel:0,wheelDown:false,tilt:0,tiltReady:false,tiltCenter:0,tiltLast:0};
const keys=new Set();let gamepadWas=false,gamepadLastCam=false,clock=performance.now(),elapsed=0,frame=0,lastHud=0,lastSave=0,lastMap=0,gameTime=0;
let cameraMode=0,cam={x:0,y:7,z:-18},camOrbit=0,camPitch=0.1,mouseDrag=null,viewerCar=0;
const trap=()=>state.modal!==null;
const ui={money:$('cashTop'),speed:$('speed'),speedBar:$('speedBar').firstElementChild,car:$('carLabel'),distance:$('distance'),mult:$('multiplier'),pts:$('chainScore'),meter:$('streakMeter').firstElementChild,tricks:$('trickFeed')};
function notify(msg){const d=document.createElement('div');d.className='notification';d.textContent=msg;$('notifications').append(d);setTimeout(()=>d.remove(),3650)}
function showTrick(title,pay,caption=''){const d=document.createElement('div');d.className='trick-toast';const top=document.createElement('div');top.textContent=title+'  ';const b=document.createElement('b');b.textContent='+'+money(pay)+' CR';top.append(b);d.append(top);if(caption){const s=document.createElement('small');s.textContent=caption;d.append(s)}ui.tricks.prepend(d);setTimeout(()=>d.remove(),1800);while(ui.tricks.children.length>3)ui.tricks.lastElementChild.remove()}
function award(title,base,caption){const multiplier=1+Math.min(4,player.chain*.24);const pay=Math.max(1,Math.round(base*multiplier));state.credits+=pay;player.chain=Math.min(18,player.chain+1);player.chainAge=0;player.chainPoints+=Math.round(base*multiplier*10);showTrick(title,pay,caption||('CHAIN ×'+multiplier.toFixed(1)));save();sound('reward');return pay}
function breakChain(){player.chain=0;player.chainPoints=0;player.chainAge=99;player.lastSide=0;player.driftPay=0}
// -------- MENU, GARAGE, SETTINGS --------
function openModal(name){state.modal=name;state.playing=false;$('overlay').classList.add('open');for(const el of document.querySelectorAll('.overlay>.modal'))el.classList.add('hidden');$(name).classList.remove('hidden');if(name==='garage')renderGarage();if(name==='rooms')renderRoom();if(name==='settings')refreshSettings();}
function closeModal(){state.modal=null;state.playing=true;$('overlay').classList.remove('open');resumeSound();}
$('driveBtn').addEventListener('click',closeModal);$('logo').addEventListener('click',()=>openModal('menu'));$('garageBtn').addEventListener('click',()=>openModal('garage'));$('roomBtn').addEventListener('click',()=>openModal('rooms'));$('settingsBtn').addEventListener('click',()=>openModal('settings'));$('menuMultiplayer').addEventListener('click',()=>openModal('rooms'));document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);if(!typing)keys.add(e.code);if(e.repeat||typing)return;if(e.code==='Escape'){state.modal?closeModal():openModal('menu')}if(e.code==='KeyC')switchCamera();if(e.code==='KeyR')resetCar();if(e.code==='KeyG')openModal('garage');if(e.code==='KeyM')openModal('rooms')});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
const gearPrice=c=>c.price===0?'FREE':money(c.price)+' CR';
function renderGarage(){const list=$('carList');list.replaceChildren();$('garageCount').textContent=`${state.unlocked.length} / ${CARS.length}`;CARS.forEach((car,i)=>{const b=document.createElement('button');b.className='car-choice'+(i===viewerCar?' active':'');const sw=document.createElement('span');sw.className='swatch';sw.style.background=car.color;const main=document.createElement('span');main.className='choice-main';const n=document.createElement('b');n.textContent=String(i+1).padStart(2,'0')+'  '+car.name;const sub=document.createElement('small');sub.textContent=car.kind.toUpperCase()+' · '+car.speed+' MPH';main.append(n,sub);const tag=document.createElement('span');const isOwned=state.unlocked.includes(i);tag.className='lock'+(isOwned?' owned':'');tag.textContent=state.carId===i?'ACTIVE':isOwned?'OWNED':'◈ '+money(car.price);b.append(sw,main,tag);b.onclick=()=>{viewerCar=i;renderGarage()};list.append(b)});const c=CARS[viewerCar];$('carPreview').style.setProperty('--preview',c.color);$('carClass').textContent=c.kind.toUpperCase();$('carNumber').textContent='CAR '+String(viewerCar+1).padStart(2,'0')+' / 20';$('detailName').textContent=c.name;$('detailDesc').textContent=c.description;$('carPrice').textContent=gearPrice(c);$('carIllustration').style.width=(c.kind==='truck'||c.kind==='suv'?270:c.kind==='hyper'?250:260)+'px';let specs=[['TOP SPEED',c.speed/250,c.speed+' MPH'],['ACCEL',c.accel/17,c.accel.toFixed(1)],['HANDLING',c.handle/1.2,(c.handle*100).toFixed(0)],['BRAKING',c.brake/28,c.brake.toFixed(1)],['GRIP',c.grip/1.25,(c.grip*100).toFixed(0)]];const bars=$('statBars');bars.replaceChildren();for(const [label,value,num] of specs){const row=document.createElement('div');row.className='stat-row';const a=document.createElement('span');a.textContent=label;const b=document.createElement('div');const f=document.createElement('span');f.style.width=Math.min(100,value*100)+'%';b.append(f);const t=document.createElement('strong');t.textContent=num;row.append(a,b,t);bars.append(row)}const btn=$('buyCarBtn');const owned=state.unlocked.includes(viewerCar);btn.textContent=state.carId===viewerCar?'CURRENT CAR':owned?'SELECT CAR':'UNLOCK CAR';btn.disabled=state.carId===viewerCar;}
$('buyCarBtn').onclick=()=>{const c=CARS[viewerCar];if(!state.unlocked.includes(viewerCar)){if(state.credits<c.price){notify(`Need ${money(c.price-state.credits)} more CR to unlock ${c.name}.`);return}state.credits-=c.price;state.unlocked.push(viewerCar);notify('Unlocked '+c.name+'!');}state.carId=viewerCar;const keepSpeed=Math.min(player.speed,c.speed/2.237);player.speed=keepSpeed;ui.car.textContent=c.name.toUpperCase();if(state.room)sendWS({t:'car',carId:viewerCar});save();renderGarage()};
function refreshSettings(){let p=state.prefs;$('assistToggle').checked=p.assist;$('trafficSelect').value=String(p.traffic);$('qualitySelect').value=p.quality;$('audioToggle').checked=p.audio;$('unitSelect').value=p.unit;$('mobileToggle').checked=p.mobile;}
for(const [id,key,parser] of [['assistToggle','assist',e=>e.target.checked],['trafficSelect','traffic',e=>Number(e.target.value)],['qualitySelect','quality',e=>e.target.value],['audioToggle','audio',e=>e.target.checked],['unitSelect','unit',e=>e.target.value],['mobileToggle','mobile',e=>e.target.checked]])$(id).addEventListener('change',e=>{state.prefs[key]=parser(e);save();if(key==='mobile')updateTouchUI();if(key==='quality')resize();if(key==='audio')resumeSound()});
$('cameraBtn').onclick=switchCamera;$('resetBtn').onclick=resetCar;
function switchCamera(){cameraMode=(cameraMode+1)%3;notify(['CHASE CAMERA','HOOD CAMERA','DISTANT CAMERA'][cameraMode])}
function resetCar(){player.speed=0;player.vx=0;player.vz=0;player.vy=0;player.grounded=true;player.onRamp=false;player.y=roadY(player.z)+.73;player.x=roadX(player.z)+2.85;player.yaw=Math.atan(roadSlope(player.z));breakChain();notify('Car reset to the highway.')}
// -------- MOBILE INPUT --------
function updateTouchUI(){const enabled=isCoarse()||state.prefs.mobile;document.body.classList.toggle('is-touch',enabled);$('touchControls').classList.toggle('hidden',!enabled);document.querySelectorAll('.steering-options button').forEach(b=>b.classList.toggle('active',b.dataset.steer===state.steerMode));$('arrowsSteer').classList.toggle('hidden',state.steerMode!=='arrows');$('wheelSteer').classList.toggle('hidden',state.steerMode!=='wheel');$('tiltSteer').classList.toggle('hidden',state.steerMode!=='tilt')}
for(const b of document.querySelectorAll('.steering-options button'))b.onclick=()=>{state.steerMode=b.dataset.steer;touch.wheel=0;touch.tilt=0;save();updateTouchUI()};
for(const button of document.querySelectorAll('[data-control]')){const k=button.dataset.control;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch[k]=true;button.classList.add('pressed')});for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,()=>{touch[k]=false;button.classList.remove('pressed')})}
$('driftTouch').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touch.drift=true;e.currentTarget.classList.add('pressed')});for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('driftTouch').addEventListener(ev,()=>{touch.drift=false;$('driftTouch').classList.remove('pressed')});
let wheelDrag=null;const wheel=$('wheelControl');wheel.addEventListener('pointerdown',e=>{e.preventDefault();wheel.setPointerCapture(e.pointerId);wheelDrag={x:e.clientX,start:touch.wheel};touch.wheelDown=true});wheel.addEventListener('pointermove',e=>{if(!wheelDrag)return;touch.wheel=clamp(wheelDrag.start+(e.clientX-wheelDrag.x)/85,-1,1);wheel.style.setProperty('--rot',touch.wheel*140+'deg')});for(const ev of ['pointerup','pointercancel','lostpointercapture'])wheel.addEventListener(ev,()=>{wheelDrag=null;touch.wheelDown=false});
function onOrientation(e){const angle=Number(screen.orientation?.angle)||0;let raw=angle===90||angle===270?e.beta:e.gamma;if(raw===null||!Number.isFinite(raw))return;touch.tiltLast=raw;if(touch.tiltReady)touch.tilt=clamp((raw-touch.tiltCenter)/(angle===90||angle===270?18:20),-1,1);$('tiltValue').textContent=touch.tiltReady?`STEER ${Math.round(touch.tilt*100)}%`:'TILT TO STEER'}
window.addEventListener('deviceorientation',onOrientation,true);
$('enableTilt').addEventListener('click',async()=>{try{if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){const v=await DeviceOrientationEvent.requestPermission();if(v!=='granted'){notify('Motion permission denied. Use arrows or wheel.');return}}touch.tiltCenter=touch.tiltLast;touch.tiltReady=true;notify('Tilt steering calibrated. Hold your phone level to go straight.')}catch(e){notify('Tilt unavailable here. Check browser motion permissions.')}});
const canvas=$('world');canvas.addEventListener('pointerdown',e=>{if(trap()||e.pointerType!=='mouse')return;mouseDrag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging')});canvas.addEventListener('pointermove',e=>{if(!mouseDrag)return;camOrbit=clamp(camOrbit-(e.clientX-mouseDrag.x)*.006,-Math.PI*.9,Math.PI*.9);camPitch=clamp(camPitch+(e.clientY-mouseDrag.y)*.003,-.24,.7);mouseDrag={x:e.clientX,y:e.clientY}});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{mouseDrag=null;canvas.classList.remove('dragging')});
canvas.addEventListener('wheel',e=>{if(trap())return;e.preventDefault();cameraMode=2;camPitch=clamp(camPitch+e.deltaY*.0006,-.2,.6)},{passive:false});
// -------- AUDIO: local synthesized sounds; no downloads --------
let audioCtx=null,engineOsc=null,engineGain=null;
function resumeSound(){if(!state.prefs.audio){if(engineGain)engineGain.gain.value=0;return}try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();if(!engineOsc){engineOsc=audioCtx.createOscillator();engineOsc.type='sawtooth';engineGain=audioCtx.createGain();engineGain.gain.value=0;engineOsc.connect(engineGain).connect(audioCtx.destination);engineOsc.start()}}catch{}}
function sound(type){if(!state.prefs.audio||!audioCtx)return;try{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.connect(gain).connect(audioCtx.destination);const t=audioCtx.currentTime;osc.type=type==='crash'?'sawtooth':'sine';osc.frequency.setValueAtTime(type==='crash'?92:660,t);osc.frequency.exponentialRampToValueAtTime(type==='crash'?35:1020,t+.13);gain.gain.setValueAtTime(.06,t);gain.gain.exponentialRampToValueAtTime(.001,t+.16);osc.start(t);osc.stop(t+.17)}catch{}}
function gamepadInput(){const pads=navigator.getGamepads?.()||[];const pad=Array.from(pads).find(p=>p&&p.connected);if(!pad){gamepadWas=false;return null}if(!gamepadWas){gamepadWas=true;notify('Controller connected. Left stick + triggers to drive.')}const ax=pad.axes||[],buttons=pad.buttons||[];const axis=i=>Math.abs(ax[i]||0)>.1?ax[i]:0;const trigger=(i,axIndex)=>buttons[i]?buttons[i].value:(Number.isFinite(ax[axIndex])?Math.max(0,(ax[axIndex]+1)/2):0);const cam=!!buttons[3]?.pressed;if(cam&&!gamepadLastCam&&!trap())switchCamera();gamepadLastCam=cam;camOrbit=clamp(camOrbit+(axis(2)||0)*.018,-2,2);return{steer:axis(0),gas:trigger(7,5),brake:trigger(6,4),drift:!!buttons[0]?.pressed||!!buttons[4]?.pressed}}
function controlInputs(dt){let steer=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));let gas=Number(keys.has('KeyW')||keys.has('ArrowUp'));let brake=Number(keys.has('KeyS')||keys.has('ArrowDown'));let drift=keys.has('Space');const gp=gamepadInput();if(gp){if(Math.abs(gp.steer)>.12)steer=gp.steer;gas=Math.max(gas,gp.gas);brake=Math.max(brake,gp.brake);drift=drift||gp.drift}if(touch.left||touch.right)steer=Number(touch.right)-Number(touch.left);if(state.steerMode==='wheel'&&touch.wheelDown)steer=touch.wheel;if(state.steerMode==='tilt'&&touch.tiltReady)steer=touch.tilt;if(touch.throttle)gas=1;if(touch.brake)brake=1;if(touch.drift)drift=true;if(!touch.wheelDown&&Math.abs(touch.wheel)>.001){touch.wheel*=Math.pow(.06,dt);$('wheelControl').style.setProperty('--rot',touch.wheel*140+'deg')}return{steer,gas,brake,drift}}
// -------- TRAFFIC, DRIVE PHYSICS, TRICK ECONOMY --------
const trafficSeen=new Map();let lastTraffic=[];
function trafficAround(z,behind=100,ahead=400){const t=(Date.now()/1000)%7200,objects=[];for(let lane=0;lane<4;lane++){const v=[12.2,17.1,20.5,24.8][lane],start=Math.floor((z-behind-t*v)/162)-1,end=Math.ceil((z+ahead-t*v)/162)+1;for(let n=start;n<=end;n++){const id=lane+':'+n;if(seedHash(n*89.4+lane*100.6)>state.prefs.traffic)continue;const tz=n*162+seedHash(n*17.3+lane*93.5)*25+t*v;if(tz<z-behind-12||tz>z+ahead+12)continue;const carId=Math.floor(seedHash(n*27.2+lane*22.4)*20);objects.push({id,lane,z:tz,x:roadX(tz)+LANES[lane]+(seedHash(n*8+lane*19)-.5)*.35,v,carId})}}return objects}
function angleDiff(a,b){let r=(a-b+Math.PI)%TAU;if(r<0)r+=TAU;return r-Math.PI}
function drive(dt){const c=CARS[state.carId],inp=controlInputs(dt);const maxSpeed=c.speed/2.237;
 let offRoad=Math.abs(player.x-roadX(player.z))>ROAD_HALF+.7;
 let resist=.28+.0008*player.speed*player.speed+(offRoad?1.85:0);
 player.speed+=((inp.gas?inp.gas*c.accel:0)-resist-(inp.brake?(c.brake*inp.brake):0))*dt;
 player.speed=clamp(player.speed,0,maxSpeed);if(!inp.gas&&!inp.brake&&player.speed<.26)player.speed=0;
 const speedFactor=clamp(player.speed/25,0,1),turnRate=(.35+1.28*speedFactor)*(c.handle/.85)*(inp.drift?1.47:1);
 player.yaw+=inp.steer*turnRate*dt;
 if(state.prefs.assist&&!inp.drift){const target=Math.atan(roadSlope(player.z));const weight=Math.abs(inp.steer)<.3?.94:.15;player.yaw-=angleDiff(player.yaw,target)*dt*weight}
 const targetVX=Math.sin(player.yaw)*player.speed,targetVZ=Math.cos(player.yaw)*player.speed;
 const traction=clamp((inp.drift?.95:4.3)*c.grip*dt,0,1);
 player.vx=mix(player.vx,targetVX,traction);player.vz=mix(player.vz,targetVZ,traction);
 const oldZ=player.z;player.x+=player.vx*dt;player.z+=player.vz*dt;
 const currentRamp=rampAt(player.z,player.x),surface=roadHeightAt(player.x,player.z)+.72;
 if(player.onRamp&&!currentRamp&&player.speed>13){player.grounded=false;player.vy=clamp(player.speed*.23,5.5,15.5);player.airTime=0;}
 player.onRamp=!!currentRamp;
 if(player.grounded){const priorY=player.y;player.y=surface;const slope=(roadY(player.z+1)-roadY(player.z-1))*.5;
   player.vy=currentRamp?player.vz*.285:player.vz*slope;
   if(!currentRamp&&player.speed>23&&priorY>surface+.16){player.grounded=false;player.y=priorY;player.airTime=0}
 }else{player.vy-=20.5*dt;player.y+=player.vy*dt;player.airTime+=dt;
   if(player.y<=surface){const flown=player.airTime;player.y=surface;player.vy=0;player.grounded=true;player.airTime=0;if(flown>.28&&player.speed>8)award('AIRTIME LANDED',Math.round(70+flown*160),flown.toFixed(1)+'s airborne');}
 }
 if(player.grounded&&currentRamp&&oldZ<currentRamp.end&&player.z>=currentRamp.end-.4){player.onRamp=false;player.grounded=false;player.vy=Math.max(5,player.speed*.25);}
 const slip=Math.abs(angleDiff(Math.atan2(player.vx,player.vz),player.yaw));const isDrifting=player.speed>13&&player.grounded&&!offRoad&&(inp.drift||slip>.13)&&Math.abs(inp.steer)>.08;
 if(isDrifting){player.driftTime+=dt;player.driftPay+=dt;if(player.driftPay>.93){award('DRIFT',Math.round(25+slip*120+player.driftTime*7),player.driftTime.toFixed(1)+'s slide');player.driftPay=0}}else{player.driftTime=0;player.driftPay=0}
 state.distance+=Math.max(0,player.speed)*dt/1609.344;
 player.chainAge+=dt;if(player.chainAge>11&&player.chain>0)breakChain();
 const traffic=trafficAround(player.z,50,85);for(const v of traffic){const rel=v.z-player.z,dx=player.x-v.x,nearY=player.y<roadY(player.z)+3.1;
  if(Math.abs(rel)<3.8&&Math.abs(dx)<2.5&&nearY&&performance.now()-player.lastCrash>1400){player.lastCrash=performance.now();player.speed*=.3;player.vx*=.3;player.vz*=.3;breakChain();notify('Collision! Trick chain lost.');sound('crash')}
  const prev=trafficSeen.get(v.id);if(prev!==undefined&&prev>0&&rel<=0&&Math.abs(dx)<6.15&&Math.abs(dx)>2.45&&player.speed>v.v+7&&nearY){award('CLOSE CALL',Math.round(80+Math.max(0,6.15-Math.abs(dx))*35),'Clean pass at '+Math.round(player.speed*2.237)+' mph');const side=dx>0?1:-1;if(player.lastSide&&side!==player.lastSide&&performance.now()-player.lastNear<7000)award('TRAFFIC WEAVE',110,'Alternating lanes bonus');player.lastSide=side;player.lastNear=performance.now();}
  trafficSeen.set(v.id,rel);
 }if(trafficSeen.size>1400)trafficSeen.clear();lastTraffic=traffic;
 if(player.speed>2&&player.z<oldZ-4)notify('Heading back down the highway.');
 if(state.prefs.audio&&engineGain&&audioCtx){engineOsc.frequency.setTargetAtTime(48+player.speed*3,audioCtx.currentTime,.09);engineGain.gain.setTargetAtTime(trap()?0:.016+player.speed*.0004,audioCtx.currentTime,.08)}
}
function refreshHUD(t){if(t-lastHud<75)return;lastHud=t;const c=CARS[state.carId],scale=state.prefs.unit==='kmh'?3.6:2.237;const maxSpeed=state.prefs.unit==='kmh'?c.speed*1.60934:c.speed;
 ui.speed.textContent=Math.round(player.speed*scale);ui.speed.nextElementSibling.textContent=state.prefs.unit==='kmh'?'KM/H':'MPH';ui.speedBar.style.width=Math.min(100,player.speed*scale/maxSpeed*100)+'%';ui.money.textContent=money(state.credits);ui.car.textContent=c.name.toUpperCase();ui.distance.textContent=state.prefs.unit==='kmh'?(state.distance*1.60934).toFixed(1)+' KM':state.distance.toFixed(1)+' MI';ui.mult.textContent='×'+(1+Math.min(4,player.chain*.24)).toFixed(1);ui.pts.innerHTML=money(player.chainPoints)+' <small>PTS</small>';ui.meter.style.width=(player.chain?Math.max(0,(11-player.chainAge)/11*100):0)+'%';$('surfaceStatus').textContent=player.grounded?(Math.abs(player.x-roadX(player.z))>ROAD_HALF?'GRAVEL':player.driftTime>.25?'DRIFTING':'ASPHALT'):'AIRBORNE';$('carLabel').textContent=c.name.toUpperCase();$('connectionStatus').textContent=state.room?`${state.room.code} · ${state.room.players.length} DRIVER${state.room.players.length===1?'':'S'}`:'SOLO SESSION';$('roomIndicator').textContent=state.room?state.room.code:'PRIVATE ROOMS';document.querySelector('.online-dot').classList.toggle('connected',!!state.room);}
// -------- WEBGL RENDERER --------
const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
if(!gl){const er=document.createElement('div');er.style.cssText='position:fixed;inset:40%;z-index:90;padding:20px;background:#101d2a;color:white';er.textContent='WebGL is not available. Try a current version of Safari, Chrome or Edge with graphics acceleration enabled.';document.body.append(er);return}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const vert=`attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uVP;uniform vec3 uCam;varying vec3 vColor;varying float vFog;void main(){vec3 n=normalize(aNormal);float light=.45+.52*max(dot(n,normalize(vec3(-.35,.95,.55))),0.0);vColor=aColor*light;vFog=clamp((distance(aPos,uCam)-95.0)/390.0,0.0,.84);gl_Position=uVP*vec4(aPos,1.0);}`;
const frag=`precision mediump float;varying vec3 vColor;varying float vFog;void main(){vec3 fog=vec3(.42,.44,.56);gl_FragColor=vec4(mix(vColor,fog,vFog),1.0);}`;
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vert));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const locPos=gl.getAttribLocation(program,'aPos'),locN=gl.getAttribLocation(program,'aNormal'),locC=gl.getAttribLocation(program,'aColor'),locVP=gl.getUniformLocation(program,'uVP'),locCam=gl.getUniformLocation(program,'uCam');const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(locPos);gl.enableVertexAttribArray(locN);gl.enableVertexAttribArray(locC);gl.vertexAttribPointer(locPos,3,gl.FLOAT,false,36,0);gl.vertexAttribPointer(locN,3,gl.FLOAT,false,36,12);gl.vertexAttribPointer(locC,3,gl.FLOAT,false,36,24);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
let verts=[],originZ=0,viewW=0,viewH=0;
function rgb(hex){const n=parseInt(hex.replace('#',''),16);return[(n>>16)/255,((n>>8)&255)/255,(n&255)/255]}
const COLORS={road:[.116,.171,.234],shoulder:[.18,.23,.27],edge:[.34,.85,.77],line:[.75,.83,.83],yellow:[1,.68,.31],grass:[.16,.30,.30],grass2:[.18,.34,.31],ground:[.14,.245,.27],dark:[.045,.072,.105],glass:[.07,.17,.24],glassHi:[.20,.35,.44],light:[.95,.92,.72],tail:[1,.21,.24],tire:[.035,.045,.060],wheel:[.35,.45,.51],ramp:[.23,.31,.38]};
function adjust(c,amount){return[c[0]*amount,c[1]*amount,c[2]*amount]}
function pushVertex(v,n,c){verts.push(v[0],v[1],v[2]-originZ,n[0],n[1],n[2],c[0],c[1],c[2])}
function tri(a,b,c,col){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const length=Math.hypot(nx,ny,nz)||1;const norm=[nx/length,ny/length,nz/length];pushVertex(a,norm,col);pushVertex(b,norm,col);pushVertex(c,norm,col)}
function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col)}
function transform(x,y,z,yaw){const s=Math.sin(yaw),c=Math.cos(yaw);return (dx,dy,dz)=>[x+dx*c+dz*s,y+dy,z+dz*c-dx*s]}
function box(x,y,z,w,h,d,col,yaw=0){const f=transform(x,y,z,yaw),a=f(-w/2,-h/2,-d/2),b=f(w/2,-h/2,-d/2),c=f(w/2,-h/2,d/2),dd=f(-w/2,-h/2,d/2),e=f(-w/2,h/2,-d/2),ff=f(w/2,h/2,-d/2),g=f(w/2,h/2,d/2),i=f(-w/2,h/2,d/2);quad(e,ff,g,i,adjust(col,1.05));quad(a,dd,c,b,adjust(col,.65));quad(a,b,ff,e,adjust(col,.76));quad(dd,i,g,c,adjust(col,.82));quad(a,e,i,dd,adjust(col,.91));quad(b,c,g,ff,adjust(col,.91))}
function pyramid(x,baseY,z,r,height,col){const top=[x,baseY+height,z],a=[x-r,baseY,z-r],b=[x+r,baseY,z-r],c=[x+r,baseY,z+r],d=[x-r,baseY,z+r];tri(a,top,b,adjust(col,.80));tri(b,top,c,col);tri(c,top,d,adjust(col,.98));tri(d,top,a,adjust(col,.85))}
function roadStrip(z1,z2,offset1,offset2,col,yoffset=0){const x1=roadX(z1),x2=roadX(z2),y1=roadY(z1)+yoffset,y2=roadY(z2)+yoffset;quad([x1+offset1,y1,z1],[x2+offset1,y2,z2],[x2+offset2,y2,z2],[x1+offset2,y1,z1],col)}
function cylinderShadow(x,z,w,d,y){quad([x-w,y,z-d],[x+w,y,z-d],[x+w,y,z+d],[x-w,y,z+d],[.075,.10,.12])}
function carMesh(x,y,z,yaw,carIndex,isRemote=false){const car=CARS[clamp(carIndex|0,0,19)],color=rgb(car.color),type=car.kind;const isTruck=['suv','truck'].includes(type),isFast=['sport','hyper','electric','super'].includes(type),isCompact=type==='hatch',isMuscle=type==='muscle',isLuxury=type==='luxury';const len=isTruck?5.35:isCompact?3.75:isFast?4.6:isMuscle?5.05:4.5;const w=isTruck?2.30:isFast?2.22:2.05,lower=isFast?.23:.31;const f=transform(x,y,z,yaw);
 function localBox(dx,dy,dz,ww,hh,ll,col){const p=f(dx,dy,dz);box(...p,ww,hh,ll,col,yaw)}
 const ground=roadY(z);cylinderShadow(x,z,w*1.1,len*.51,ground+.052);
 localBox(0,-.16,0,w,.52,len,adjust(color,.85));localBox(0,-.01,len*.26,w*.92,.25,len*.37,adjust(color,1.13));localBox(0,-.035,-len*.34,w*.92,.28,len*.25,adjust(color,.92));
 const roofH=isTruck?1.02:isFast?.53:isMuscle?.64:.73;localBox(0,.3+roofH*.28,-(isTruck?.13:.24),w*.78,roofH,len*(isTruck?.57:.44),adjust(color,1.08));
 localBox(0,.35,-(isTruck?-.02:.18),w*.79,roofH*.73,len*(isTruck?.53:.40),COLORS.glass);
 localBox(0,.58+roofH*.18,-.34,w*.69,.09,len*(isTruck?.35:.22),adjust(color,.92));
 if(isTruck)localBox(0,.48,-len*.33,w*.88,.55,len*.17,adjust(color,.86));
 if(isFast){localBox(0,.31,-len*.48,w*.94,.08,.16,adjust(color,.66));if(type==='hyper'||type==='super')localBox(0,.37,-len*.49,w*.95,.12,.27,COLORS.dark)}
 if(isMuscle)localBox(0,.17,len*.19,w*.42,.13,len*.25,COLORS.dark);
 if(type==='rally'){localBox(0,.86,-.4,w*.5,.16,.5,COLORS.dark);localBox(0,.89,-.42,w*.24,.1,.22,COLORS.light)}
 for(const side of [-1,1])for(const zz of [-len*.30,len*.30]){localBox(side*(w*.51),-.38,zz,.27,.57,.73,COLORS.tire);localBox(side*(w*.56),-.38,zz,.07,.35,.39,COLORS.wheel)}
 localBox(-w*.32,-.12,len*.5,w*.20,.12,.08,COLORS.light);localBox(w*.32,-.12,len*.5,w*.20,.12,.08,COLORS.light);
 localBox(-w*.33,-.12,-len*.50,w*.21,.12,.08,COLORS.tail);localBox(w*.33,-.12,-len*.50,w*.21,.12,.08,COLORS.tail);
 localBox(0,-.29,len*.50,w*.36,.09,.13,COLORS.dark);localBox(0,-.29,-len*.51,w*.45,.11,.11,COLORS.dark);
 if(!isRemote&&player.driftTime>.2&&player.grounded){const t=Math.min(.5,player.driftTime*.15);for(const sd of [-1,1]){const p=f(sd*.68,-.66,-len*.55);const back=f(sd*.68,-.66,-len*.55-2.2*t);quad([p[0]-.08,ground+.055,p[2]],[p[0]+.08,ground+.055,p[2]],[back[0]+.1,ground+.055,back[2]],[back[0]-.1,ground+.055,back[2]],[.08,.11,.14]);}}
}
function roadMesh(){const q=state.prefs.quality,behind=q==='low'?88:105,ahead=q==='high'?720:q==='medium'?530:370,step=q==='high'?8:12;
 const start=Math.floor((player.z-behind)/step)*step,end=player.z+ahead;
 for(let z=start;z<end;z+=step){const z2=z+step,cx1=roadX(z),cx2=roadX(z2),y1=roadY(z),y2=roadY(z2);const sc=seedHash(Math.floor(z/step));
 quad([cx1-240,y1-1.8,z],[cx2-240,y2-1.8,z2],[cx2+240,y2-1.8,z2],[cx1+240,y1-1.8,z],sc>.5?COLORS.grass:COLORS.grass2);
 roadStrip(z,z2,-15,-ROAD_HALF,COLORS.shoulder,.008);roadStrip(z,z2,ROAD_HALF,15,COLORS.shoulder,.008);
 roadStrip(z,z2,-ROAD_HALF,ROAD_HALF,COLORS.road,.028);
 roadStrip(z,z2,-ROAD_HALF-.25,-ROAD_HALF+.10,COLORS.edge,.055);roadStrip(z,z2,ROAD_HALF-.10,ROAD_HALF+.25,COLORS.edge,.055);
 if((Math.floor(z/step)%2)===0)for(const laneLine of [-5.68,0,5.68])roadStrip(z+.7,z+Math.min(7.2,step-.5),laneLine-.085,laneLine+.085,COLORS.line,.066);
 if(z%240<step)roadStrip(z,z+1,-ROAD_HALF,ROAD_HALF,[.28,.35,.41],.038);
 }
 // Raised launch ramps: placed deterministically every 720 meters, alternate lanes.
 const n0=Math.floor((player.z-behind-330)/720),n1=Math.ceil((player.z+ahead-330)/720);
 for(let n=n0;n<=n1;n++){const start=n*720+330,end=start+25,offset=n%2===0?2.85:-2.85;
  for(let j=0;j<10;j++){const a=start+j*2.5,b=a+2.5;if(b<player.z-behind||a>player.z+ahead)continue;const v1=roadX(a)+offset,v2=roadX(b)+offset,h1=roadY(a)+j*2.5*.285+.08,h2=roadY(b)+(j+1)*2.5*.285+.08;
   quad([v1-2.55,h1,a],[v2-2.55,h2,b],[v2+2.55,h2,b],[v1+2.55,h1,a],j%2===0?[.28,.39,.43]:[.34,.46,.49]);
   if(j%2===0){quad([v1-1.85,h1+.03,a],[v2-1.85,h2+.03,b],[v2-1.55,h2+.03,b],[v1-1.55,h1+.03,a],COLORS.yellow);quad([v1+1.55,h1+.03,a],[v2+1.55,h2+.03,b],[v2+1.85,h2+.03,b],[v1+1.85,h1+.03,a],COLORS.yellow)}
  }
  const signZ=start-13;if(signZ>player.z-behind&&signZ<player.z+ahead){const sx=roadX(signZ)+offset;box(sx,roadY(signZ)+2.1,signZ,4.5,1.1,.21,COLORS.yellow);box(sx,roadY(signZ)+2.12,signZ+.13,3.4,.28,.12,COLORS.dark)}
 }
}
function scenery(){const q=state.prefs.quality;const start=Math.floor((player.z-90)/41),end=Math.floor((player.z+(q==='low'?355:q==='medium'?510:690))/41);
 for(let n=start;n<=end;n++){const z=n*41,cx=roadX(z),base=roadY(z)-1.8;
  for(const sd of [-1,1]){const r=seedHash(n*21.13+sd*71),dist=25+r*42,x=cx+sd*dist;
   if(r<.83){const h=6+seedHash(n*32.4+sd)*6;box(x,base+h*.18,z,.65,h*.56,.65,[.21,.18,.18]);pyramid(x,base+1.1,z,2.8,h*.62,[.12,.34,.33]);pyramid(x,base+2.7,z,2.3,h*.70,[.16,.43,.38]);}else{box(x,base+1.2,z,3.2,2,3.5,[.33,.32,.33]);}
   if(n%4===0){const lx=cx+sd*17.8;box(lx,roadY(z)+4.6,z,.16,9.4,.16,[.40,.52,.55]);box(lx-sd*1.3,roadY(z)+9.25,z,2.5,.17,.2,[.52,.58,.60]);box(lx-sd*2.5,roadY(z)+9.12,z,.5,.11,.43,COLORS.light);}
   if(q!=='low'&&n%3===0){const h=14+seedHash(n*9.1+sd)*26,bx=cx+sd*(95+seedHash(n*41+sd)*30);box(bx,base+h/2,z,11+seedHash(n*7)*10,h,11,[.18,.27,.35]);if(n%2===0)for(let w=0;w<3;w++)box(bx+sd*5,base+5+w*4,z+4,.1,.5,1.2,[.53,.68,.70]);}
  }
  if(n%8===0){const z2=z+12,y2=roadY(z2);box(roadX(z2)-17,roadY(z2)+3.8,z2,.3,7.6,.3,[.42,.60,.61]);box(roadX(z2)+17,roadY(z2)+3.8,z2,.3,7.6,.3,[.42,.60,.61]);box(roadX(z2),y2+7.5,z2,34,.32,.35,[.36,.59,.62]);box(roadX(z2),y2+6.9,z2,9,1.6,.42,[.20,.41,.47]);}
 }
}
function matPerspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
function matLookAt(eye,target){let z=[eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]],zl=Math.hypot(...z)||1;z=z.map(a=>a/zl);let x=[z[2],0,-z[0]],xl=Math.hypot(...x)||1;x=x.map(a=>a/xl);const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1])}
function multiply(a,b){const o=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)o[col*4+row]=a[row]*b[col*4]+a[4+row]*b[col*4+1]+a[8+row]*b[col*4+2]+a[12+row]*b[col*4+3];return o}
function resize(){const dpr=Math.min(window.devicePixelRatio||1,state.prefs.quality==='low'?1:state.prefs.quality==='high'?1.8:1.3),ww=Math.max(1,Math.floor(canvas.clientWidth*dpr)),hh=Math.max(1,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==ww||canvas.height!==hh){canvas.width=ww;canvas.height=hh;gl.viewport(0,0,ww,hh)}viewW=ww;viewH=hh}window.addEventListener('resize',()=>{resize();updateTouchUI()});
function render(dt){resize();verts=[];originZ=Math.floor(player.z/200)*200;
 roadMesh();scenery();const traffic=trafficAround(player.z,100,state.prefs.quality==='low'?290:390);for(const v of traffic)carMesh(v.x,roadY(v.z)+.75,v.z,Math.atan(roadSlope(v.z)),v.carId,true);
 const now=performance.now();for(const [id,r] of state.remote){if(now-r.last>5500){state.remote.delete(id);continue}const factor=clamp((now-r.last)/130,0,1),xz=r.current,prev=r.previous||xz;const x=mix(prev.x,xz.x,factor),z=mix(prev.z,xz.z,factor);if(Math.abs(z-player.z)>420)continue;carMesh(x,Math.max(roadY(z)+.73,mix(prev.y||roadY(z)+.73,xz.y||roadY(z)+.73,factor)),z,mix(prev.yaw,xz.yaw,factor),r.carId,true)}
 if(cameraMode!==1)carMesh(player.x,player.y,player.z,player.yaw,state.carId);
 const angle=player.yaw+camOrbit;let goal,target;if(cameraMode===1){goal=[player.x+Math.sin(player.yaw)*1.45,player.y+1.02,player.z+Math.cos(player.yaw)*1.45];target=[player.x+Math.sin(player.yaw)*25,player.y+.7,player.z+Math.cos(player.yaw)*25];}else{const distance=cameraMode===2?29:14.5,up=cameraMode===2?12:6.0;goal=[player.x-Math.sin(angle)*distance,player.y+up+camPitch*6,player.z-Math.cos(angle)*distance];target=[player.x+Math.sin(player.yaw)*9,player.y+1.8,player.z+Math.cos(player.yaw)*9]}
 const smoothing=clamp(dt*5.6,.02,1);cam.x=mix(cam.x,goal[0],smoothing);cam.y=mix(cam.y,goal[1],smoothing);cam.z=mix(cam.z,goal[2],smoothing);
 const projection=matPerspective(68*Math.PI/180,viewW/viewH,.1,900);const view=matLookAt([cam.x,cam.y,cam.z-originZ],[target[0],target[1],target[2]-originZ]);gl.uniformMatrix4fv(locVP,false,multiply(projection,view));gl.uniform3f(locCam,cam.x,cam.y,cam.z-originZ);
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,verts.length/9);
}
function minimap(){const c=$('mapCanvas'),cx=c.getContext('2d');const w=c.width,h=c.height;cx.clearRect(0,0,w,h);cx.fillStyle='#091c2d';cx.fillRect(0,0,w,h);
 const scale=1.6,originX=w/2,originY=h-18,reference=roadX(player.z);const coord=(z,x)=>[originX+(x-reference)*scale,originY-(z-player.z)*.36];
 cx.strokeStyle='#365663';cx.lineWidth=29;cx.beginPath();for(let i=0;i<=16;i++){const z=player.z+i*20,p=coord(z,roadX(z));if(!i)cx.moveTo(...p);else cx.lineTo(...p)}cx.stroke();cx.strokeStyle='#93b7b7';cx.lineWidth=.9;cx.setLineDash([6,7]);for(const lane of [-5.68,0,5.68]){cx.beginPath();for(let i=0;i<=16;i++){const z=player.z+i*20,p=coord(z,roadX(z)+lane);if(!i)cx.moveTo(...p);else cx.lineTo(...p)}cx.stroke()}cx.setLineDash([]);
 cx.fillStyle='#ffb977';for(const v of lastTraffic){if(v.z-player.z<0||v.z-player.z>320)continue;const p=coord(v.z,v.x);cx.fillRect(p[0]-2,p[1]-3,4,6)}
 const me=coord(player.z,player.x);cx.save();cx.translate(...me);cx.rotate(-player.yaw);cx.fillStyle='#56ffe0';cx.beginPath();cx.moveTo(0,-8);cx.lineTo(-5,5);cx.lineTo(5,5);cx.closePath();cx.fill();cx.restore()}
function frameLoop(now){let dt=clamp((now-clock)/1000,0,.045);clock=now;elapsed+=dt;frame++;if(state.playing)drive(dt);else gamepadInput();render(dt||.016);refreshHUD(now);if(now-lastMap>180){lastMap=now;minimap()}if(elapsed-lastSave>14){lastSave=elapsed;save()}requestAnimationFrame(frameLoop)}
// -------- PRIVATE MULTIPLAYER ROOMS --------
function sendWS(message){if(state.ws?.readyState===WebSocket.OPEN){state.ws.send(JSON.stringify(message));return true}return false}
let pendingRoom=null,connecting=null;
function connectWS(){if(state.ws?.readyState===WebSocket.OPEN)return Promise.resolve();if(connecting)return connecting;if(!/^https?:$/.test(location.protocol))return Promise.reject(Error('Open this game using the included Node.js server to host online rooms.'));
 connecting=new Promise((resolve,reject)=>{const secure=location.protocol==='https:',url=(secure?'wss:':'ws:')+'//'+location.host+'/ws';let sock;try{sock=new WebSocket(url)}catch(e){connecting=null;reject(e);return}let timeout=setTimeout(()=>{try{sock.close()}catch{};connecting=null;reject(Error('Could not reach game server. Start node server.js first.'))},5000);
 sock.addEventListener('open',()=>{clearTimeout(timeout);state.ws=sock;state.connected=true;connecting=null;resolve()});sock.addEventListener('message',e=>{try{handleServerMessage(JSON.parse(e.data))}catch(err){console.warn('Server message:',err)}});sock.addEventListener('close',()=>{clearTimeout(timeout);if(state.ws===sock){const had=!!state.room;state.ws=null;state.connected=false;state.room=null;state.remote.clear();if(had)notify('Disconnected from private room. Solo driving continues.');if(state.modal==='rooms')renderRoom()}});sock.addEventListener('error',()=>{});
 }) ;return connecting}
async function requestRoom(t,extra){try{await connectWS();const request={t,name:$('playerName').value.trim()||'Driver',carId:state.carId,...extra};sendWS(request)}catch(e){notify(e.message);$('serverNote').textContent=e.message}}
$('createRoomBtn').addEventListener('click',()=>{const password=$('createPassword').value;if(password.length<4){notify('Room password must be at least 4 characters.');return}requestRoom('create',{roomName:$('createRoomName').value||'Private cruise',password})});
$('joinRoomBtn').addEventListener('click',()=>{const code=$('joinCode').value.trim().toUpperCase();if(code.length!==6){notify('Enter a six-character invite code.');return}requestRoom('join',{code,password:$('joinPassword').value})});
$('leaveRoomBtn').onclick=()=>{sendWS({t:'leave'});state.room=null;state.remote.clear();renderRoom();notify('You left the private room.');};
$('copyInvite').onclick=async()=>{if(!state.room)return;const c=state.room.code,url=location.origin+'/?room='+encodeURIComponent(c);try{await navigator.clipboard.writeText(`NIGHTSHIFT private room: ${c}\nJoin: ${url}\nPassword: ask me for it privately.`);notify('Invite code and join link copied.')}catch{window.prompt('Share this invite code (password separately):',c)}};
function addChat(name,text,isNotice=false){const row=document.createElement('div'),who=document.createElement('b');if(isNotice){row.textContent=text;row.style.color='#ffc88f'}else{who.textContent=name+': ';row.append(who,document.createTextNode(text))}const c=$('chatHistory');c.append(row);c.scrollTop=c.scrollHeight;while(c.children.length>35)c.firstElementChild.remove()}
function sendChat(){const box=$('chatInput'),text=box.value.trim();if(!text)return;sendWS({t:'chat',text});box.value=''}$('chatSend').onclick=sendChat;$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendChat()}});
function renderRoom(){const active=!!state.room;$('roomsOffline').classList.toggle('hidden',active);$('roomsOnline').classList.toggle('hidden',!active);if(!active)return;$('roomCodeBig').textContent=state.room.code;$('memberCount').textContent=state.room.players.length+' / 12';const list=$('memberList');list.replaceChildren();for(const p of state.room.players){const row=document.createElement('div');row.className='member-row';const n=document.createElement('span');n.textContent=p.name+(p.id===state.myId?' (YOU)':'');const tag=document.createElement('small');tag.textContent=p.host?'HOST':CARS[p.carId]?.name.toUpperCase()||'DRIVER';row.append(n,tag);if(state.room.host&&p.id!==state.myId){const b=document.createElement('button');b.textContent='KICK';b.onclick=()=>sendWS({t:'kick',id:p.id});row.append(b)}list.append(row)}}
function handleServerMessage(m){if(!m||typeof m!=='object')return;
 if(m.t==='error'){notify(m.message||'Room error');return}
 if(m.t==='joined'){state.myId=m.you;state.room={code:m.code,name:m.roomName,host:!!m.host,players:m.players||[]};state.remote.clear();$('chatHistory').replaceChildren();addChat('',`Connected to ${m.roomName}. Share the invite code and password.`,true);renderRoom();notify('Room '+m.code+' created/joined. You are online.');return}
 if(m.t==='members'&&state.room){state.room.players=m.players||[];state.room.host=!!state.room.players.find(p=>p.id===state.myId)?.host;if(m.notice)addChat('',m.notice,true);renderRoom();return}
 if(m.t==='notice'){addChat('',m.text,true);return}
 if(m.t==='left'){state.room=null;state.remote.clear();if(state.modal==='rooms')renderRoom();return}
 if(m.t==='kicked'){state.room=null;state.remote.clear();notify('Room host removed you.');if(state.modal==='rooms')renderRoom();return}
 if(m.t==='chat'){addChat(m.name||'Driver',m.text||'');return}
 if(m.t==='snapshot'&&state.room){const now=performance.now();const ids=new Set();for(const p of m.players||[]){if(p.id===state.myId)continue;ids.add(p.id);const next={x:Number(p.x)||0,y:Number(p.y)||0,z:Number(p.z)||0,yaw:Number(p.yaw)||0};const remote=state.remote.get(p.id);if(remote){remote.previous=remote.current;remote.current=next;remote.last=now;remote.carId=p.carId}else state.remote.set(p.id,{previous:next,current:next,last:now,carId:p.carId})}
 for(const id of state.remote.keys())if(!ids.has(id))state.remote.delete(id);}
}
const inviteCode=new URLSearchParams(location.search).get('room');if(inviteCode){$('joinCode').value=inviteCode.toUpperCase().slice(0,6);$('serverNote').textContent='Invite link detected. Enter the room password to join.'}
setInterval(()=>{if(state.room&&state.playing)sendWS({t:'state',x:Math.round(player.x*100)/100,y:Math.round(player.y*100)/100,z:Math.round(player.z*100)/100,yaw:player.yaw,speed:player.speed})},100);
// -------- STARTUP --------
viewerCar=state.carId;resize();updateTouchUI();renderGarage();refreshSettings();requestAnimationFrame(frameLoop);
window.NIGHTSHIFT={version:'1.0.0',getState:()=>({car:state.carId,credits:state.credits,unlocked:[...state.unlocked],position:{x:player.x,y:player.y,z:player.z},speed:player.speed,room:state.room?.code||null}),reset:resetCar};
})();
