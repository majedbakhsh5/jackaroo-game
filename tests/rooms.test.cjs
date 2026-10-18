const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../room-client.js'),'utf8');
function memoryDatabase(){
 let data={},writes=0;const listeners=[];
 const clone=v=>v===undefined?null:JSON.parse(JSON.stringify(v));
 const read=(obj,path)=>path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],obj)??null;
 function put(obj,path,value){const keys=path.split('/').filter(Boolean),last=keys.pop();let at=obj;for(const k of keys)at=at[k]??={};if(value===null)delete at[last];else at[last]=clone(value)}
 const snap=(key,value)=>({key,val:()=>clone(value),exists:()=>value!==null&&value!==undefined});
 function change(mutate){const before=clone(data);mutate();writes++;
  for(const l of [...listeners]){const a=read(before,l.path),b=read(data,l.path);if(JSON.stringify(a)===JSON.stringify(b))continue;
   if(l.event==='value')queueMicrotask(()=>l.fn(snap(l.path.split('/').pop(),b)));
   else for(const [k,v]of Object.entries(b||{})){if(l.event==='child_added'&&!a?.[k]||l.event==='child_changed'&&a?.[k]&&JSON.stringify(a[k])!==JSON.stringify(v))queueMicrotask(()=>l.fn(snap(k,v)))}
  }
 }
 function ref(path=''){return {child:k=>ref(path+'/'+k),once:async()=>snap(path.split('/').pop(),read(data,path)),
  set:async value=>change(()=>put(data,path,value)),remove:async()=>change(()=>put(data,path,null)),
  update:async updates=>change(()=>{for(const [k,v]of Object.entries(updates))put(data,path+'/'+k,v)}),
  transaction:async fn=>{const next=fn(read(data,path));if(next===undefined)return {committed:false};change(()=>put(data,path,next));return {committed:true}},
  on:(event,fn)=>{listeners.push({path,event,fn});const value=path==='.info/connected'?true:read(data,path);if(event==='value')queueMicrotask(()=>fn(snap(path.split('/').pop(),value)));else if(event==='child_added')for(const [k,v]of Object.entries(value||{}))queueMicrotask(()=>fn(snap(k,v)))},
  off:(event,fn)=>{const i=listeners.findIndex(l=>l.path===path&&l.event===event&&l.fn===fn);if(i>=0)listeners.splice(i,1)},
  onDisconnect:()=>({remove:async()=>{}})
 }}
 return {ref,get data(){return data},get writes(){return writes}};
}
function client(db,uid){
 const auth=()=>({currentUser:{uid},setPersistence:async()=>{}});auth.Auth={Persistence:{SESSION:'session'}};
 const database=()=>db;database.ServerValue={TIMESTAMP:Date.now()};
 const window={ROOM_CONFIG:{enabled:true,firebase:{}},firebase:{apps:[{}],auth,database},crypto:crypto.webcrypto};
 const document={createElement:()=>({}),head:{appendChild:s=>queueMicrotask(()=>s.onload())}};
 const context=vm.createContext({window,document,Uint8Array,Date,Map,Promise,JSON,Number,Object,Array,Error});vm.runInContext(source,context);return window.JackarooRooms;
}
const flush=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r))};
const state=()=>({m:Array.from({length:4},()=>[-100,-100,-100,-100]),hands:[[{r:'A',s:'♠'}],[{r:'K',s:'♥'}],[{r:'2',s:'♦'}],[{r:'3',s:'♣'}]],deck:[{r:'Q',s:'♠'}],turn:1,phase:'play',log:[],msg:'',over:0,busy:0,skip:[0,0,0,0],rem:0,exc:-1});
function hooks(overrides={}){return {onStatus:()=>{},onView:()=>{},onCommand:()=>{},onEmoji:()=>{},onPlayers:()=>{},...overrides}}
test('host, guests and spectator receive distinct hands; unchanged state causes no writes',async()=>{
 const db=memoryDatabase(),views=[],commands=[];const host=await client(db,'host').connect(null,hooks({onCommand:(c,p)=>commands.push({c,p})}));await host.publish(state());await host.start();await flush();
 const guests=[];for(let n=1;n<=3;n++){const g=await client(db,'guest'+n).connect(host.id,hooks({onView:v=>views.push({n,v})}));guests.push(g);await g.start();await flush()}
 await host.publish(state());await flush();assert.deepEqual(guests.map(g=>g.seat),[1,2,3]);
 const spectatorViews=[];const spectator=await client(db,'spectator').connect(host.id,hooks({onView:v=>spectatorViews.push(v)}));await spectator.start();await flush();assert.equal(spectator.seat,-1);
 const latest=views.filter(x=>x.n===1).at(-1).v;assert.equal(latest.hand[0].r,'K');assert.equal(latest.state.hands,undefined);assert.equal(latest.state.deck,undefined);assert.equal(spectatorViews.at(-1).hand.length,0);
 const writes=db.writes;await host.publish(state());await flush();assert.equal(db.writes,writes);
 await guests[0].command({type:'play',card:{r:'K',s:'♥'},move:'legal'},latest.revision);await flush();assert.equal(commands.length,1);assert.equal(commands[0].p,1);
 await guests[0].command({type:'play',card:{r:'K',s:'♥'},move:'stale'},latest.revision-1);await flush();assert.equal(commands.length,1);
 for(const g of guests)await g.close();await spectator.close();await host.close();
});
test('a returning host restores its role and the saved game',async()=>{
 const db=memoryDatabase(),api=client(db,'host');const host=await api.connect(null,hooks());await host.publish(state());await host.close();
 const restored=await api.connect(host.id,hooks());assert.equal(restored.isHost,true);assert.equal(restored.seat,0);assert.equal(restored.restored.hands[1][0].r,'K');await restored.close();
});
