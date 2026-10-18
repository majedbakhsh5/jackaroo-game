const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=()=>fs.readFileSync(path.join(root,'game.js'),'utf8');
test('restarting a game invalidates pending turn callbacks',()=>{
 const js=source(); const timer=js.slice(js.indexOf('const $='),js.indexOf('// ---------- نظام الغرف'));
 const jobs=[];const context={document:{getElementById:()=>null},setTimeout:(fn)=>{jobs.push(fn);return jobs.length},clearTimeout:()=>{}};
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
 const setup=`const N=76,E=[0,19,38,57],CN=['blue','red','green','gold'],NAME=CN,RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],SU=['♠','♥','♦','♣'];let S;let room=null,localSeat=-1,isSpectator=false;const SFX={play(){}};const jobs=[];const later=(ms,f)=>jobs.push(f);const cpuSeat=()=>true,localPlayer=()=>0,scheduleCPU=()=>{},draw=()=>{},clearRings=()=>{},anim=()=>{},centerCard=()=>{},pick=()=>{};`;
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
