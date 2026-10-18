const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=()=>fs.readFileSync(path.join(root,'game.js'),'utf8');
test('restarting a game invalidates pending turn callbacks',()=>{
 const js=source(); const timer=js.slice(js.indexOf('const $='),js.indexOf('// ---------- نظام الغرف'));
 const jobs=[];const context={window:{},document:{getElementById:()=>null},setTimeout:(fn)=>{jobs.push(fn);return jobs.length},clearTimeout:()=>{}};
 vm.createContext(context);vm.runInContext(timer+'\nlet calls=0;later(1,()=>calls++);resetGameTimers();',context);
 jobs.forEach(fn=>fn());assert.equal(vm.runInContext('calls',context),0);
});
test('only one emoji handler exists',()=>assert.equal([...source().matchAll(/function sendEmoji\(/g)].length,1));
test('all HTML inline scripts parse',()=>{
 for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
  const html=fs.readFileSync(path.join(root,f),'utf8');for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1],{filename:f});
 }
});
const rooms=require('../room-client.js');
test('public room snapshots exclude deck and every private hand',()=>{
 const hands=[[{r:'A',s:'♠'}],[{r:'K',s:'♥'}],[],[]];
 const state={hands,deck:[{r:'J',s:'♣'}],m:Array.from({length:4},()=>[-100,-100,-100,-100]),turn:0,phase:'play',log:[],msg:''};
 const spectator=rooms.createView(state,-1,1),guest=rooms.createView(state,1,1);
 assert.equal('hands' in guest.state,false);assert.equal('deck' in guest.state,false);assert.deepEqual(spectator.hand,[]);assert.deepEqual(guest.hand,hands[1]);assert.equal(JSON.stringify(guest).includes('♠'),false);assert.equal(rooms.validView(guest),true);
});
test('room input validation rejects malformed IDs, board state and card faces',()=>{
 assert.equal(rooms.validRoom('../rooms'),false);assert.equal(rooms.validRoom('ab'.repeat(12)),true);
 assert.equal(rooms.validView({revision:1,state:{turn:9,phase:'play'},hand:[]}),false);
});
test('complete AI matches preserve board occupancy and finish',()=>{
 const js=source(),engine=js.slice(js.indexOf('const abs='),js.indexOf('/* ---------- تدفق اللاعب'));
 const setup=`const N=76,E=[0,19,38,57],CN=['blue','red','green','gold'],NAME=CN,RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],SU=['♠','♥','♦','♣'];let S;let room=null,localSeat=-1,isSpectator=false;const playerName=p=>CN[p];const SFX={play(){}};const jobs=[];const later=(ms,f)=>jobs.push(f);const cpuSeat=()=>true,localPlayer=()=>0,scheduleCPU=()=>{},draw=()=>{},clearRings=()=>{},anim=()=>{},centerCard=()=>{},pick=()=>{},burst=()=>{},ringFx=()=>{},BT=.4,THREE={Vector3:class{constructor(){}}};`;
 const context=vm.createContext({Math});vm.runInContext(setup+engine+js.slice(js.indexOf('function burnAI('),js.indexOf('function selMarble(')),context);
 const result=vm.runInContext(`let total=0;for(let match=0;match<5;match++){
 S={m:[0,1,2,3].map(()=>[-100,-100,-100,-100]),deck:[],hands:[[],[],[],[]],turn:0,phase:'play',starter:match%4,skip:[0,0,0,0],rem:0,exc:-1,bp:null,sel:null,stage:0,opt:null,srcs:[],log:[],msg:'',busy:0,over:0,cc:null};jobs.length=0;startRound();
 for(let step=0;step<12000&&!S.over;step++){
  cpu();let guard=0;while(jobs.length){if(++guard>30)throw Error('callback loop');jobs.shift()()}
  const occupied=new Set();for(let p=0;p<4;p++)for(const r of S.m[p]){if(r===-100)continue;if(r>=1000){if(r>1003)throw Error('invalid finish');continue}const at=abs(p,r);if(occupied.has(at))throw Error('overlapping marbles');occupied.add(at)}
  if(S.hands.some(h=>h.length>5))throw Error('too many cards');total++;
 }
 if(!S.over)throw Error('match did not finish');
}total`,context,{timeout:10000});assert.ok(result>100);
});
test('a five enters the safe lane only for self or partner, for every seat colour',()=>{
 const js=source(),engine=js.slice(js.indexOf('const abs='),js.indexOf('const ev='));
 const setup=`const N=76,E=[0,19,38,57],CN=['blue','red','green','gold'],RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],NAME=CN;let S;`;
 const c=vm.createContext({});vm.runInContext(setup+engine,c);
 for(let actor=0;actor<4;actor++){
  const result=vm.runInContext(`{S={m:Array.from({length:4},()=>[-100,-100,-100,-100]),rem:0,exc:-1};S.m[${actor}][0]=72;const mate=(${actor}+2)%4,left=(${actor}+1)%4,right=(${actor}+3)%4;S.m[mate][0]=72;S.m[left][0]=72;S.m[right][0]=72;const moves=gen({r:'5'},${actor});({mate:moves.find(m=>m.c===mate),left:moves.find(m=>m.c===left),right:moves.find(m=>m.c===right),self:moves.find(m=>m.c===${actor})})}`,c);
  for(const key of ['self','mate'])assert.equal(result[key].to,1002,`${key} seat ${actor} may enter safety`);
  for(const key of ['left','right'])assert.equal(result[key].to,77,`rival seat ${actor} must continue on the outer track`);
 }
});
test('the five cannot move a marble already in a safe lane and auto plays a sole move',()=>{
 const js=source(),engine=js.slice(js.indexOf('const abs='),js.indexOf('const ev='));
 const setup=`const N=76,E=[0,19,38,57],CN=['blue','red','green','gold'],RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],NAME=CN;let S;`;
 const c=vm.createContext({});vm.runInContext(setup+engine,c);
 const count=vm.runInContext(`S={m:Array.from({length:4},()=>[-100,-100,-100,-100]),rem:0,exc:-1};S.m[0][0]=72;S.m[1][0]=1001;gen({r:'5'},0).some(m=>m.c===1)`,c);assert.equal(count,false);
 const flow=js.slice(js.indexOf('function refreshSrc('),js.indexOf('function burnCard('));
 const auto=vm.createContext({S:{moves:[{k:'fwd',c:0,i:0,n:2,to:3,caps:[]}],opt:null,srcs:[],sel:0,opts:[]},localPlayer:()=>0,MS:[[{}]],clearRings(){},play:(...args)=>{auto.called=args},mkey:m=>'f'+m.n,draw(){}});
 vm.runInContext(flow+'refreshSrc()',auto);assert.deepEqual(auto.called.slice(0,2),[0,0]);
});
test('a rival five wraps around the outer route instead of entering its safety lane',()=>{
 const js=source(),engine=js.slice(js.indexOf('const abs='),js.indexOf('const ev='));
 const setup=`const N=76,E=[0,19,38,57],CN=['blue','red','green','gold'],NAME=CN;let S;`;
 const c=vm.createContext({});vm.runInContext(setup+engine,c);
 const to=vm.runInContext(`S={m:Array.from({length:4},()=>[-100,-100,-100,-100])};S.m[1][0]=150;fwdFiveRival(1,0).to`,c);assert.equal(to,79);
});
