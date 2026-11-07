'use strict';
// NIGHTSHIFT multiplayer: zero third-party dependencies. Start: node server.js
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {URL}=require('node:url');
const PORT=Number(process.env.PORT)||3000;
const HOST=process.env.HOST||'0.0.0.0';
const WEBROOT=path.resolve(__dirname,'public');
const rooms=new Map();
const peers=new Set();
const MAX_PLAYERS=12;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let url;try{url=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end('Bad request')}
 if(url.pathname==='/api/health')return res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:true,players:peers.size,rooms:rooms.size,version:'1.1.0'}));
 if(req.method!=='GET' && req.method!=='HEAD')return res.writeHead(405).end('Method not allowed');
 let relative;try{relative=decodeURIComponent(url.pathname)}catch{return res.writeHead(400).end('Invalid URL')}
 if(relative==='/play')return res.writeHead(308,{Location:'/play/'+url.search}).end();
 if(relative.endsWith('/'))relative+='index.html';
 const file=path.resolve(WEBROOT,'.'+relative);
 if(!file.startsWith(WEBROOT+path.sep))return res.writeHead(403).end('Forbidden');
 fs.stat(file,(error,st)=>{
  if(error||!st.isFile())return res.writeHead(404).end('Not found');
  res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':path.extname(file)==='.html'?'no-cache':'public,max-age=300','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 });
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const clean=(s,n=26)=>String(s||'').replace(/[<>\u0000-\u001F]/g,'').trim().slice(0,n);
const roomCode=()=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s;do{s=Array.from(crypto.randomBytes(6),v=>alphabet[v%alphabet.length]).join('')}while(rooms.has(s));return s};
const broadcast=(room,obj,except)=>{for(const p of room.players)if(p!==except)p.send(obj)};
function member(p){return {id:p.id,name:p.name,carId:p.carId,host:p.room?.host===p}}
function joined(p,room){p.send({t:'joined',code:room.code,roomName:room.name,you:p.id,host:room.host===p,maxPlayers:MAX_PLAYERS,players:[...room.players].map(member)});broadcast(room,{t:'members',players:[...room.players].map(member)})}
function leave(p){const room=p.room;if(!room)return;room.players.delete(p);p.room=null;if(room.host===p)room.host=[...room.players][0]||null;if(!room.players.size)rooms.delete(room.code);else broadcast(room,{t:'members',players:[...room.players].map(member),notice:p.name+' left the room'});}
function handleMessage(p,m){
 if(!m||typeof m!=='object'||!m.t)return;
 const now=Date.now();if(now-p.rateWindow>1000){p.rateWindow=now;p.rateCount=0}if(++p.rateCount>90)return;
 if(m.t==='ping'){p.send({t:'pong'});return}
 if(m.t==='create'){
  if(p.room)return p.send({t:'error',message:'Leave your current room first.'});
  const name=clean(m.name,20)||'Driver',title=clean(m.roomName,36)||'Private cruise';const password=String(m.password||'');
  if(password.length<4||password.length>64)return p.send({t:'error',message:'Password must contain 4–64 characters.'});
  const salt=crypto.randomBytes(16);const hash=crypto.scryptSync(password,salt,32);
  const room={code:roomCode(),name:title,salt,hash,players:new Set(),host:p,created:now};rooms.set(room.code,room);
  p.name=name;p.carId=clamp(Math.trunc(Number(m.carId)||0),0,19);p.room=room;room.players.add(p);joined(p,room);
 }else if(m.t==='join'){
  if(p.room)return p.send({t:'error',message:'Leave your current room first.'});
  const code=clean(m.code,12).toUpperCase(),room=rooms.get(code);
  if(!room)return p.send({t:'error',message:'Room not found. Check the invite code.'});
  if(room.players.size>=MAX_PLAYERS)return p.send({t:'error',message:'This room is full.'});
  const pw=String(m.password||'');if(pw.length>64)return p.send({t:'error',message:'Incorrect password.'});
  const attempt=crypto.scryptSync(pw,room.salt,32);
  if(!crypto.timingSafeEqual(attempt,room.hash))return p.send({t:'error',message:'Incorrect room password.'});
  p.name=clean(m.name,20)||'Driver';p.carId=clamp(Math.trunc(Number(m.carId)||0),0,19);p.room=room;room.players.add(p);joined(p,room);
  broadcast(room,{t:'notice',text:p.name+' joined the cruise.'},p);
 }else if(m.t==='leave'){
  leave(p);p.send({t:'left'});
 }else if(m.t==='state' && p.room){
  const x=Number(m.x),y=Number(m.y),z=Number(m.z),yaw=Number(m.yaw),speed=Number(m.speed);
  if(![x,y,z,yaw,speed].every(Number.isFinite)||Math.abs(x)>2e8||Math.abs(z)>2e8||Math.abs(y)>1e5)return;
  p.state={x,y,z,yaw:clamp(yaw,-1e6,1e6),speed:clamp(speed,-100,500)};
 }else if(m.t==='car' && p.room){
  p.carId=clamp(Math.trunc(Number(m.carId)||0),0,19);broadcast(p.room,{t:'members',players:[...p.room.players].map(member)});
 }else if(m.t==='chat'&&p.room){
  if(now-p.lastChat<800)return;p.lastChat=now;
  const msg=clean(m.text,160);if(msg)broadcast(p.room,{t:'chat',name:p.name,id:p.id,text:msg,time:now});
 }else if(m.t==='kick'&&p.room && p.room.host===p){
  const target=[...p.room.players].find(u=>u.id===m.id&&u!==p);
  if(target){target.send({t:'kicked'});leave(target)}
 }
}
class Peer{
 constructor(socket){this.socket=socket;this.buf=Buffer.alloc(0);this.id=crypto.randomBytes(5).toString('hex');this.name='Driver';this.room=null;this.carId=0;this.state=null;this.rateWindow=Date.now();this.rateCount=0;this.lastChat=0;this.closed=false;
  socket.on('data',chunk=>this.read(chunk));socket.on('error',()=>this.close());socket.on('close',()=>this.close());peers.add(this);
 }
 send(obj){if(this.closed)return;const payload=Buffer.from(JSON.stringify(obj));let head;if(payload.length<126){head=Buffer.from([0x81,payload.length])}else if(payload.length<65536){head=Buffer.alloc(4);head[0]=0x81;head[1]=126;head.writeUInt16BE(payload.length,2)}else{head=Buffer.alloc(10);head[0]=0x81;head[1]=127;head.writeBigUInt64BE(BigInt(payload.length),2)}try{this.socket.write(Buffer.concat([head,payload]))}catch{this.close()}}
 read(chunk){if(this.closed)return;this.buf=Buffer.concat([this.buf,chunk]);if(this.buf.length>65536)return this.close();
  while(this.buf.length>=2){const b0=this.buf[0],b1=this.buf[1],op=b0&15,fin=(b0&128)!==0,mask=(b1&128)!==0;let len=b1&127,offset=2;
   if(!fin||!mask)return this.close();
   if(len===126){if(this.buf.length<4)return;len=this.buf.readUInt16BE(2);offset=4}
   else if(len===127){if(this.buf.length<10)return;const big=this.buf.readBigUInt64BE(2);if(big>16384n)return this.close();len=Number(big);offset=10}
   if(len>16384)return this.close();if(this.buf.length<offset+4+len)return;
   const key=this.buf.subarray(offset,offset+4),data=Buffer.from(this.buf.subarray(offset+4,offset+4+len));for(let i=0;i<data.length;i++)data[i]^=key[i%4];this.buf=this.buf.subarray(offset+4+len);
   if(op===8)return this.close();if(op===9){this.socket.write(Buffer.from([0x8a,0x00]));continue}if(op!==1)continue;
   try{handleMessage(this,JSON.parse(data.toString('utf8')))}catch{this.send({t:'error',message:'Invalid message.'})}
  }
 }
 close(){if(this.closed)return;this.closed=true;leave(this);peers.delete(this);try{this.socket.destroy()}catch{}}
}
server.on('upgrade',(req,socket)=>{
 if(req.url.split('?')[0]!=='/ws'||req.headers.upgrade?.toLowerCase()!=='websocket'||req.headers['sec-websocket-version']!=='13')return socket.destroy();
 const key=req.headers['sec-websocket-key'];if(typeof key!=='string'||!/^[-\w+/=]{20,30}$/.test(key))return socket.destroy();
 const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');new Peer(socket);
});
setInterval(()=>{
 for(const room of rooms.values()){
  const states=[];
  for(const p of room.players)if(p.state)states.push({id:p.id,carId:p.carId,name:p.name,...p.state});
  broadcast(room,{t:'snapshot',players:states,time:Date.now()});
 }
},100);
server.listen(PORT,HOST,()=>console.log(`NIGHTSHIFT ready: http://localhost:${PORT} | LAN: http://<YOUR-IP>:${PORT}`));
