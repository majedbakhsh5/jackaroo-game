const N=76,E=[0,19,38,57],CN=['الأزرق','الأحمر','الأخضر','الذهبي'],COL=[0x2f78ff,0xe03a2f,0x2fae4f,0xe8b230],HX=['#5b9bff','#ff6a5c','#5fd37d','#f5c451'];
const RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],SU=['♠','♥','♦','♣'];
const HINT={A:'تنزيل أو 1 أو 11',K:'تنزيل أو 13 وتقتل الطريق',Q:'12 خطوة',J:'بدّل بأي دحلة',4:'4 للخلف',5:'5 لأي دحلة',7:'7 على حركتين',10:'10 أو امنع التالي'};
const SFX=typeof JackarooSound==='undefined'?{play(){},setEnabled(){return true},get enabled(){return true},wake(){}}:JackarooSound;
const $=i=>document.getElementById(i);
let gameGeneration=0;const gameTimers=new Set();
function later(ms,f){const generation=gameGeneration;const id=setTimeout(()=>{gameTimers.delete(id);if(generation===gameGeneration)f()},ms);gameTimers.add(id);return id}
function resetGameTimers(){gameGeneration++;gameTimers.forEach(clearTimeout);gameTimers.clear()}

let S,MS=[],RG=[],TW=[],PS=[];
let cpuTimer=null,ownTurnBefore=null,lastChatSend=0,turnClockHandle=null,clockKey='',warnedClockKey='';
let playerNames=[window.JACKAROO_PLAYER_NAME||'اللاعب · الأزرق','الكمبيوتر · الأحمر','الكمبيوتر · الأخضر','الكمبيوتر · الذهبي'];
const playerName=p=>playerNames[p]||CN[p];
const SEAT_ACCENT=['#5b9bff','#ff6a5c','#5fd37d','#f5c451'];

// ---------- نظام الغرف والدعوات ----------
let room=null,localSeat=0,isSpectator=false,remoteRevision=0,networkPending=false;
const roomParam=new URL(location.href).searchParams.get('room');
function localPlayer(){return localSeat<0?0:localSeat}
function cpuSeat(p){return !room||room.isHost&&!room.isHuman(p)}
function scheduleCPU(){if(cpuTimer){clearTimeout(cpuTimer);gameTimers.delete(cpuTimer);cpuTimer=null}if(!S||S.over||S.busy||!cpuSeat(S.turn)||S.turn===localSeat)return;const p=S.turn;cpuTimer=later(1400,()=>{cpuTimer=null;if(!S||S.over||S.busy||S.turn!==p||!cpuSeat(p))return;if(S.phase==='play')cpu();else if(S.phase==='burn')burnCard(0,p)})}
function connectionStatus(message){$('connection').textContent=message}
function setSeatPresentation(){const seat=localSeat<0?0:localSeat;document.body.style.setProperty('--seat-accent',SEAT_ACCENT[seat]);document.body.dataset.seat=String(seat);const label=$('seatBadge');if(label){label.hidden=false;label.textContent='مقعدك: '+CN[seat]}camAngleY=-seat*Math.PI/2;updateCamera()}
function showEmoji(emoji){const el=document.createElement('div');el.className='emoji-float';el.textContent=emoji;el.style.left=(35+Math.random()*30)+'%';document.body.appendChild(el);setTimeout(()=>el.remove(),2000)}
function roomPlayerEvent(event){const name=event.name||playerName(event.seat);const text=event.type==='leave'?`${name} غادر الغرفة؛ سيتولى الكمبيوتر مقعده`:`انضم ${name} إلى الغرفة واستلم المقعد`;connectionStatus(text);SFX.play(event.type==='leave'?'warning':'join');const note=$('roomNotice');if(note){note.textContent=text;note.hidden=false;setTimeout(()=>note.hidden=true,3800)}}
function addChatMessage(message){const list=$('chatMessages');if(!list)return;const row=document.createElement('div');row.className='chat-line'+(message.uid===room?.uid?' own':'');const name=document.createElement('b');name.textContent=playerName(message.seat)||'لاعب';name.style.color=HX[message.seat]||'';const body=document.createElement('span');body.textContent=message.text;row.append(name,body);list.appendChild(row);while(list.children.length>40)list.firstElementChild.remove();list.scrollTop=list.scrollHeight;if(message.uid!==room?.uid){SFX.play('chat');if(!$('chatPanel').open){const badge=$('chatBadge');badge.hidden=false;badge.textContent=String((Number(badge.textContent)||0)+1)}}}
async function sendChatMessage(text){if(!room||room.seat<0){connectionStatus('المحادثة متاحة للاعبين داخل الغرفة');return}if(Date.now()-lastChatSend<900){connectionStatus('انتظر لحظة قبل إرسال رسالة أخرى');return}lastChatSend=Date.now();try{await room.sendChat(text)}catch(_){connectionStatus('تعذر إرسال الرسالة')}}
function toggleSound(){const enabled=SFX.setEnabled(!SFX.enabled),button=$('soundToggle');button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'🔊 الصوت':'🔇 صامت';if(enabled)SFX.wake()}
function sendEmoji(emoji){showEmoji(emoji);if(room)room.sendEmoji(emoji).catch(()=>connectionStatus('تعذر إرسال التفاعل'));$('reactions').open=false}
async function shareGame(){
 const button=$('shareBtn');button.disabled=true;
 try{
  if(!room){connectionStatus('جارٍ إنشاء غرفة…');await connectRoom(null)}
  if(!room)throw new Error('لم تُنشأ غرفة');
  const url=new URL('play.html',location.href);url.searchParams.set('room',room.id);
  if(navigator.share){try{await navigator.share({title:'جاكارو',text:'انضم للعب معي',url:url.href});return}catch(e){if(e.name==='AbortError')return}}
  if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(url.href);connectionStatus('تم نسخ رابط الغرفة')}
  else window.prompt('انسخ رابط الغرفة:',url.href);
 }catch(e){connectionStatus(e.message||'تعذر إنشاء الغرفة؛ اللعب الفردي متاح')}
 finally{button.disabled=false}
}
function leaveSpectate(){location.href='play.html'}
async function leaveRoom(){if(room)await room.close().catch(()=>{});location.href='game.html'}
function snapshotGame(){return {m:S.m,deck:S.deck,hands:S.hands,turn:S.turn,turnAt:S.turnAt,phase:S.phase,starter:S.starter,skip:S.skip,rem:S.rem,exc:S.exc,bp:S.bp??null,bf:S.bf??null,rc:S.rc,started:S.started,log:S.log,over:S.over,busy:S.busy,msg:S.msg||''}}
function syncStateToFirebase(){if(room&&room.isHost)room.publish(snapshotGame()).catch(()=>connectionStatus('تعذرت المزامنة؛ تحقق من الاتصال'))}
function receiveGame(view){
 if(!JackarooRooms.validView(view)||view.revision<=remoteRevision)return;
 remoteRevision=view.revision;resetGameTimers();clearRings();if(S.cc)S.cc.remove();TW=[];
 const st=view.state;S={...S,...st,hands:[[],[],[],[]],sel:null,stage:0,opt:null,srcs:[],moves:[],opts:[],cc:null,dealt:0};
 if(localSeat>=0)S.hands[localSeat]=view.hand||[];
 for(let p=0;p<4;p++)for(let i=0;i<4;i++)MS[p][i].position.copy(P(p,S.m[p][i],i));
 networkPending=false;draw();
}
function commandMove(command,seat){
 if(!room||!room.isHost||S.over||S.busy||S.turn!==seat||!room.isHuman(seat))return;
 const ci=S.hands[seat].findIndex(c=>c.r===command.card?.r&&c.s===command.card?.s);if(ci<0)return;
 if(S.phase==='burn'){if(command.type==='burn')burnCard(ci,seat);return}
 if(S.phase!=='play')return;
 const legal=gen(S.hands[seat][ci],seat);
 if(command.type==='discard'){if(!S.hands[seat].some(c=>gen(c,seat).length))play(seat,ci,null);return}
 if(command.type!=='play')return;
 const mv=legal.find(m=>moveKey(m)===command.move);if(mv)play(seat,ci,mv);
}
const moveKey=m=>JSON.stringify([m.k,m.c,m.i,m.n??null,m.to??null,m.tp??null,m.tj??null]);
function submitCommand(command){if(networkPending)return;networkPending=true;room.command(command,remoteRevision).catch(()=>{networkPending=false;connectionStatus('تعذر إرسال الحركة')});later(3000,()=>{networkPending=false})}
async function connectRoom(id){
 const result=await JackarooRooms.connect(id,{name:window.JACKAROO_PLAYER_NAME,onStatus:connectionStatus,onView:receiveGame,onCommand:commandMove,onEmoji:showEmoji,onChat:addChatMessage,onPlayerEvent:roomPlayerEvent,onHostChange:state=>{if(!room?.isHost||!state)return;resetGameTimers();S={...S,...state,busy:state.started?0:1,sel:null,stage:0,opt:null,srcs:[],moves:[],opts:[],cc:null};for(let p=0;p<4;p++)for(let i=0;i<4;i++)MS[p][i].position.copy(P(p,S.m[p][i],i));draw();scheduleCPU()},onPlayers:()=>{if(room){for(let p=0;p<4;p++)playerNames[p]=room.nameForSeat(p);connectionStatus(room.isHost?'أنت مضيف الغرفة — الكمبيوتر يدير المقاعد الشاغرة':isSpectator?'الغرفة مكتملة — أنت مشاهد':'متصل بالغرفة — '+playerName(localSeat));scheduleCPU();draw()}}});
 room=result;localSeat=room.seat;isSpectator=localSeat<0;$('roomLeave').hidden=false;
 setSeatPresentation();
 playerNames[localSeat]=window.JACKAROO_PLAYER_NAME||CN[localSeat];
 $('top').querySelector('button').disabled=!room.isHost;
 const url=new URL(location.href);url.searchParams.set('room',room.id);history.replaceState({},'',url);
 if(room.isHost){if(room.restored){resetGameTimers();S={...S,...room.restored,busy:room.restored.started?0:1,sel:null,stage:0,opt:null,srcs:[],moves:[],opts:[],cc:null};for(let p=0;p<4;p++)for(let i=0;i<4;i++)MS[p][i].position.copy(P(p,S.m[p][i],i));draw()}await room.publish(snapshotGame());scheduleCPU()}
 else{resetGameTimers();S.busy=1;S.hands=[[],[],[],[]];draw()}
 await room.start();
 const invite=new URL('play.html',location.href);invite.searchParams.set('room',room.id);$('inviteLink').value=invite.href;
 $('invitePanel').hidden=!room.isHost;$('invitePanel').open=room.isHost&&!S.started;
 $('startMatch').hidden=!room.isHost||!!S.started;
 $('top').querySelector('button').hidden=!S.started;
 if(room.isHost&&!S.started)connectionStatus('الغرفة جاهزة — شارك الرابط ثم اضغط ابدأ المباراة');
 if(isSpectator){$('spectatorMsg').style.display='block';$('spectatorMsg').querySelector('p').textContent='المقاعد مكتملة. يمكنك إغلاق هذه الرسالة ومشاهدة المباراة.';$('spectatorMsg').querySelector('button').textContent='متابعة المشاهدة';$('spectatorMsg').querySelector('button').onclick=()=>{$('spectatorMsg').style.display='none'}}
}

/* ---------- وضع الكاميرا والدوران ---------- */
let camMode=0,camAngleX=1.48,camAngleY=0,boardZoom=1;
const seatAngle=(p=localSeat)=>-(p<0?0:p)*Math.PI/2;
function updateCamera(){
 const rect=$('board').getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height);
 ren.setSize(w,h,false);cam.aspect=w/h;cam.clearViewOffset();cam.updateProjectionMatrix();
 const target=new THREE.Vector3(0,.4,0),direction=new THREE.Vector3(Math.sin(camAngleY)*Math.cos(camAngleX),Math.sin(camAngleX),Math.cos(camAngleY)*Math.cos(camAngleX));
 // Fit the home orientation; rotating keeps the same scale instead of pulling away.
 const fitYaw=seatAngle(),fitDirection=new THREE.Vector3(Math.sin(fitYaw)*Math.cos(camAngleX),Math.sin(camAngleX),Math.cos(fitYaw)*Math.cos(camAngleX));
 let low=14,high=240;
 for(let i=0;i<24;i++){
  const dist=(low+high)/2;cam.position.copy(target).addScaledVector(fitDirection,dist);cam.lookAt(target);cam.updateMatrixWorld();
  let fits=true;for(const x of [-13.8,13.8])for(const z of [-13.8,13.8])for(const y of [.1,1.7]){const p=new THREE.Vector3(x,y,z).project(cam);if(Math.abs(p.x)>.9||Math.abs(p.y)>.9||p.z>1)fits=false}
  if(fits)high=dist;else low=dist;
 }
 cam.position.copy(target).addScaledVector(direction,high/boardZoom);cam.lookAt(target);cam.updateMatrixWorld();
}
function changeZoom(factor){boardZoom=Math.max(.7,Math.min(3,boardZoom*factor));updateCamera()}
function toggleCameraMode(){camMode=(camMode+1)%3;camAngleX=camMode===0?1.48:camMode===1?1.25:1.05;camAngleY=seatAngle();$('controls').style.display=camMode===1?'flex':'none';$('camToggle').textContent=['من الأعلى','دوران حر','منظور مائل'][camMode];updateCamera()}
function resetCamera(){boardZoom=1;camAngleX=camMode===0?1.48:camMode===1?1.25:1.05;camAngleY=seatAngle();updateCamera()}
function showHint(){if(!S||S.over)return;const cd=S.hands[localPlayer()][S.sel];S.msg=cd?`توضيح: ${cd.r}${cd.s} — ${HINT[cd.r]||cd.r+' خطوات'}`:'اختر ورقة أولاً لتظهر طريقة لعبها';draw()}
function setupTouch(){
 const pointers=new Map(),canvas=$('cv');let moved=false,last=null,pinch=0;
 const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
 canvas.addEventListener('wheel',e=>{e.preventDefault();changeZoom(Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*.002))},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(pointers.size===1){last={x:e.clientX,y:e.clientY};moved=false}else{pinch=distance();moved=true}});
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2){const next=distance();if(pinch>0)changeZoom(next/pinch);pinch=next;moved=true;return}
  if(last&&Math.hypot(e.clientX-last.x,e.clientY-last.y)>5)moved=true;
  if(camMode===1&&moved){camAngleY-=(e.clientX-prev.x)*.005;camAngleX=Math.max(.65,Math.min(1.55,camAngleX+(e.clientY-prev.y)*.005));updateCamera()}
 });
 const finish=e=>{const tap=e.type==='pointerup'&&pointers.size===1&&!moved;pointers.delete(e.pointerId);pinch=0;if(tap)handleGameClick(e.clientX,e.clientY);if(!pointers.size)last=null};
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);pinch=0});
}
function pointerVector(cx,cy){const r=cv.getBoundingClientRect();V2.set((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1)}

/* ---------- دالة النقر على اللعبة ---------- */
function handleGameClick(cx,cy){
  pointerVector(cx,cy);
  RC.setFromCamera(V2,cam);
  if(isSpectator||networkPending||S.busy||S.turn!==localSeat||S.phase!=='play'||S.stage<3)return;
  let h=RC.intersectObjects(RG,true)[0];
  if(h){play(localPlayer(),S.sel,h.object.userData.mv);return}
  h=RC.intersectObjects(S.srcs,true)[0];
  if(h)selMarble(h.object.userData.p,h.object.userData.i,false);
}

/* ---------- المحرك ---------- */
const abs=(p,r)=>((E[p]+r)%N+N)%N,home=p=>S.m[p].every(r=>r>=LN),ctrl=p=>home(p)?(p+2)%4:p;
function occ(a,c,i){for(let q=0;q<4;q++)for(let j=0;j<4;j++){const r=S.m[q][j];if(r>Y&&r<LN&&abs(q,r)===a&&!(q===c&&j===i))return[q,j]}return null}
const Y=-100,LN=1000,norm=x=>x,hb=a=>E.indexOf(a),prot=(o,a)=>hb(a)===o[0];
function chk(c,i,cells){let n=0;for(const a of cells){const o=occ(a,c,i);if(o){if(o[0]===c||prot(o,a)||++n>1)return 0}}return 1}
function land(c,i,a){const o=occ(a,c,i);if(!o)return[];return prot(o,a)?null:[o]}
function sweep(c,i,from,to){const caps=[];for(let q=from+1;q<=to;q++){const a=abs(c,q),o=occ(a,c,i);if(o){if(prot(o,a))return null;caps.push(o)}}return caps}
function fwdMv(c,i,n,kg){const m=S.m,r=m[c][i],t=r+n,thr=r>=75?151:75;
 if(r>=LN){const k=r-LN,u=k+n;if(u>3||m[c].some((x,j)=>j!==i&&x>LN+k&&x<=LN+u))return null;return{k:'fwd',c,i,n,from:r,to:LN+u,caps:[]}}
 if(t>=thr){const k=t-thr;if(k>3||m[c].some((x,j)=>j!==i&&x>=LN&&x<=LN+k))return null;let caps=[];
  if(kg){caps=sweep(c,i,r,thr-1);if(!caps)return null}else{const ps=[];for(let q=r+1;q<thr;q++)ps.push(abs(c,q));if(!chk(c,i,ps))return null}
  return{k:'fwd',c,i,n,from:r,to:LN+k,caps}}
 let caps;
 if(kg){caps=sweep(c,i,r,t);if(!caps)return null}else{const ps=[];for(let q=r+1;q<t;q++)ps.push(abs(c,q));caps=land(c,i,abs(c,t));if(!caps||!chk(c,i,ps))return null}
 return{k:'fwd',c,i,n,from:r,to:t,caps}}
function fwdFiveRival(c,i){const r=S.m[c][i],raw=r+5,ps=[];for(let q=r+1;q<raw;q++)ps.push(abs(c,q));if(!chk(c,i,ps))return null;const caps=land(c,i,abs(c,raw));if(!caps)return null;let to=raw;while(to>=151)to-=76;return{k:'fwd',c,i,n:5,from:r,to,caps}}
function can7(mv,c,rem){const sv=S.m;S.m=sv.map(a=>a.slice());apply(S.m,mv);let ok=false;for(let i=0;i<4&&!ok;i++){if(i!==mv.i&&S.m[c][i]>Y&&fwdMv(c,i,rem,false))ok=true}S.m=sv;return ok}
function gen(cd,p){const c=ctrl(p),m=S.m,L=[],rk=cd.r,ins=m[c].some(x=>x>Y);
 if(rk==='10'&&ins)L.push({k:'skip',c,i:0,caps:[]});
 const fw=rk==='A'?[1,11]:rk==='K'?[13]:rk==='Q'?[12]:(/^\d+$/.test(rk)&&rk!=='4'&&rk!=='5'&&rk!=='7')?[+rk]:[];
 if(rk==='5'&&ins){for(let q=0;q<4;q++)for(let j=0;j<4;j++){const x=m[q][j];if(x>Y&&x<LN&&(q===c||q%2===c%2||!prot([q,j],abs(q,x)))){const mv=q%2===c%2?fwdMv(q,j,5,false):fwdFiveRival(q,j);if(mv)L.push(mv)}}}
 for(let i=0;i<4;i++){const r=m[c][i];
  if(r<=Y){if(rk==='A'||rk==='K'){const o=occ(abs(c,0),c,-1);if(!o||o[0]!==c)L.push({k:'out',c,i,from:r,to:0,caps:o?[o]:[]})}continue}
  for(const n of fw){const mv=fwdMv(c,i,n,rk==='K');if(mv)L.push(mv)}
  if(rk==='7'&&!(S.rem&&i===S.exc)){for(const n of S.rem?[S.rem]:[1,2,3,4,5,6,7]){const mv=fwdMv(c,i,n,false);if(mv&&(S.rem||n===7||can7(mv,c,7-n)))L.push(mv)}}
  if(r>=LN)continue;
  if(rk==='4'){const t=r<4?r+72:r-4,ps=[1,2,3].map(d=>abs(c,r-d)),cp=land(c,i,abs(c,t));if(cp&&chk(c,i,ps))L.push({k:'back',c,i,from:r,to:t,caps:cp})}
  if(rk==='J'&&!prot([c,i],abs(c,r)))for(let q=0;q<4;q++)for(let j=0;j<4;j++){if(q===c&&j===i)continue;const x=m[q][j];if(x>Y&&x<LN&&!prot([q,j],abs(q,x)))L.push({k:'swap',c,i,tp:q,tj:j,caps:[]})}}
 return L}
function apply(m,mv){const{c,i}=mv;if(mv.k==='skip')return;
 if(mv.k==='swap'){const a=abs(c,m[c][i]),b=abs(mv.tp,m[mv.tp][mv.tj]);m[c][i]=norm((b-E[c]+N)%N);m[mv.tp][mv.tj]=norm((a-E[mv.tp]+N)%N);return}
 mv.caps.forEach(([q,j])=>m[q][j]=Y);m[c][i]=mv.to}
const ev=(m,tm)=>{let s=0;for(let q=0;q<4;q++)for(let j=0;j<4;j++){const r=m[q][j],v=r<=Y?0:r>=LN?120+(r-LN):r+9;s+=q%2===tm?v:-v}return s};
const keep=c=>({A:9,K:9,J:8,7:7,4:6,Q:5,10:4})[c.r]??+c.r/3;
function desc(mv){const w=`حجر ${CN[mv.c]}`;let t=mv.k==='out'?`أنزل ${w}`:mv.k==='fwd'?`${w} ${mv.n} خطوة`:mv.k==='back'?`${w} 4 للخلف`:mv.k==='sc'?`${w} اختصار عبر المركز`:`بدّل ${w} مع ${CN[mv.tp]}`;
 if(mv.caps.length)t+=` 💥 أكل ${mv.caps.map(o=>CN[o[0]]).join('، ')}`;return t}
const log=t=>{S.log.unshift(t);S.log.length=Math.min(S.log.length,7)};
function startRound(){if(!S.deck.length){for(const r of RK)for(const s of SU)S.deck.push({r,s});for(let i=51;i>0;i--){const j=Math.random()*(i+1)|0;[S.deck[i],S.deck[j]]=[S.deck[j],S.deck[i]]}S.rc=0;if(S.started){S.starter=(S.starter+3)%4;log(`قائد الجولة الآن: ${playerName(S.starter)}`)}S.started=1}
 SFX.play('deal');
 const n=S.rc===2?5:4;S.rc++;for(let p=0;p<4;p++)for(let k=0;k<n;k++)S.hands[p].push(S.deck.pop());
 S.phase='play';S.turn=S.starter;S.turnAt=Date.now();S.dealt=1;S.sel=null;S.stage=0;S.msg='';log(`وُزّعت الأوراق: ${n} لكل لاعب`);draw();scheduleCPU()}
function doExchange(ci){const g=[S.hands[localPlayer()].splice(ci,1)[0]];
 for(let p=1;p<4;p++){const h=S.hands[p];let b=0;h.forEach((c,k)=>{if(keep(c)<keep(h[b]))b=k});g[p]=h.splice(b,1)[0]}
 for(let p=0;p<4;p++)S.hands[(p+2)%4].push(g[p]);
 log(`مررت ${g[0].r}${g[0].s} واستلمت ${g[2].r}${g[2].s} من شريكك`);
 S.phase='play';S.turn=S.starter;S.turnAt=Date.now();S.dealt=1;S.msg='';draw();scheduleCPU()}
function nextTurn(p){if(S.hands.every(h=>!h.length)){startRound();return}
 let q=p;for(let k=0;k<4;k++){q=(q+3)%4;if(S.skip[q]){S.skip[q]=0;log(`${playerName(q)} فاته الدور (10)`);continue}if(S.hands[q].length)break}
 if(!S.hands[q].length){nextTurn(q);return}
 S.turn=q;S.turnAt=Date.now();S.msg='';draw();scheduleCPU()}
function win(){for(let t=0;t<2;t++)if(home(t)&&home(t+2)){S.over=1;S.phase='over';S.msg=isSpectator?`انتهت اللعبة: فاز ${t?'الأحمر والذهبي':'الأزرق والأخضر'}`:t===localPlayer()%2?'🎉 مبروك! فزت أنت وشريكك':'انتهت اللعبة: فاز الفريق الآخر';SFX.play('win');burst(new THREE.Vector3(0,BT+1,0),0xffd65a,110,.75);ringFx(new THREE.Vector3(0,BT+.2,0),0xffd65a);draw();return true}return false}
function play(p,ci,mv){if(room&&!room.isHost){submitCommand({type:mv?'play':'discard',card:S.hands[p][ci],move:mv?moveKey(mv):null});return}const cd=S.hands[p][ci];let t=`${playerName(p)}: ${cd.r}${cd.s}`,part=false;S.busy=1;clearRings();
 if(!mv)SFX.play('discard');else{let sounded=false;if(mv.k==='out'){SFX.play('home');sounded=true}if(mv.to>=LN){SFX.play('safe');sounded=true}if(mv.caps?.length){SFX.play(mv.caps.some(o=>o[0]%2===p%2)?'teamCapture':'capture');sounded=true}if(!sounded)SFX.play('move')}
 const hc=S.cc;S.cc=null;centerCard(cd,p,hc&&hc.mesh);
 S.stage=0;S.opt=null;S.srcs=[];
 if(!mv){S.hands[p]=[];t=`${playerName(p)}: لا توجد ورقة تُلعب، أُحرقت كل الأوراق`}
 else if(mv.k==='skip'){S.hands[p].splice(ci,1);S.skip[(p+3)%4]=1;S.bp=(p+3)%4;t+=` ← ${playerName((p+3)%4)} يُمنع من اللعب ويحرق ورقة`}
 else{apply(S.m,mv);anim(mv);t+=' '+desc(mv);
  if(cd.r==='7'){if(!S.rem)S.exc=mv.i;S.rem=(S.rem||7)-mv.n;if(S.rem>0&&S.hands[p].some(c=>c.r==='7'&&gen(c,p).length))part=true;else{S.rem=0;S.exc=-1;S.hands[p].splice(ci,1)}}
  else S.hands[p].splice(ci,1)}
 log(t);S.sel=null;S.msg='';draw();
 later(mv?1150:600,()=>{S.busy=0;if(win())return;
  if(part){if(!cpuSeat(p)){S.msg=`تبقى ${S.rem} خطوات من الـ7`;if(p===localSeat)pick(S.hands[p].findIndex(c=>c.r==='7'));else draw()}else cpu();return}
  if(S.bp!=null){const q=S.bp;S.bp=null;if(S.hands[q].length){if(!cpuSeat(q)){S.turn=q;S.phase='burn';S.bf=p;S.turnAt=Date.now();S.msg=`طلب ${playerName(p)} منك حرق ورقة؛ اختر ورقة الآن`;SFX.play('warning');draw();return}burnAI(q)}}
  nextTurn(p)})}
function cpu(p=S.turn,force=false){if(!force)p=S.turn;if((!force&&(!cpuSeat(p)||p===localSeat))||S.over||S.busy||S.phase!=='play')return;let best=null;const tm=p%2,nx=(p+3)%4;
 S.hands[p].forEach((cd,ci)=>{if(S.rem&&cd.r!=='7')return;gen(cd,p).forEach(mv=>{let sc=Math.random()*3;
  if(mv.k==='skip')sc=S.hands[nx].length?8:-20;
  else{const t=S.m.map(a=>a.slice());apply(t,mv);sc+=ev(t,tm);
   if(mv.to>=LN&&mv.from<LN)sc+=120;       /* أولوية 1: المسار الداخلي */
   mv.caps.forEach(o=>sc+=o[0]%2===tm?-90:50);            /* أولوية 2: أكل الخصم وتجنب أكل الفريق */
   if(mv.k==='out')sc+=40;                                /* أولوية 3: الدخول */
   sc-=({J:6,4:3,A:4,K:4})[cd.r]||0}                      /* أولوية 4: إبقاء الأوراق الدفاعية */
  if(!best||sc>best.sc)best={sc,ci,mv}})});
 if(best)play(p,best.ci,best.mv);else{let b=0;S.hands[p].forEach((c,k)=>{if(keep(c)<keep(S.hands[p][b]))b=k});play(p,b,null)}}
/* ---------- تدفق اللاعب: ورقة ← حركة (نقرتان) ← حجر ---------- */
const canMove=()=>S.hands[localPlayer()].some(c=>gen(c,localPlayer()).length),mkey=m=>m.k==='fwd'?'f'+m.n:m.k;
function lab(o,cd){return o.key==='out'?'إنزال حجر من المقبرة إلى البيت':o.key==='back'?'4 خطوات للخلف':o.key==='swap'?'تبديل حجرك بحجر آخر':o.key==='sc'?'اختصار عبر المركز':o.key==='skip'?'امنع التالي من اللعب (يحرق ورقة)':`${o.n} خطوة`+(cd.r==='7'&&o.n<(S.rem||7)?` · يبقى ${(S.rem||7)-o.n}`:'')}
function pick(ci){if(isSpectator||networkPending||S.busy||S.over||ci<0)return;if(S.phase==='burn'){burnCard(ci);return}if(S.turn!==localSeat)return;
 if(S.stage>=3){if(S.cc){S.cc.remove();S.cc=null}clearRings()}
 const cd=S.hands[localPlayer()][ci];if(S.rem&&cd.r!=='7')return;
 if(!canMove()){play(localPlayer(),ci,null);return}
 S.sel=ci;S.opt=null;S.moves=gen(cd,localPlayer());S.opts=[];S.moves.forEach(m=>{if(!S.opts.some(o=>o.key===mkey(m)))S.opts.push({key:mkey(m),n:m.n})});S.opts.sort((a,b)=>(b.n||0)-(a.n||0));
 if(!S.moves.length){S.stage=0;S.sel=null;S.msg='هذه الورقة ما لها حركة، اختر غيرها';draw();return}
 S.stage=3;toCenter(ci);refreshSrc()}
function refreshSrc(){clearRings();let ms=S.moves.filter(m=>!S.opt||mkey(m)===S.opt);const sk=ms.find(m=>m.k==='skip');
 if(sk&&(S.opt==='skip'||ms.length===1)){play(localPlayer(),S.sel,sk);return}
 ms=ms.filter(m=>m.k!=='skip');S.srcs=[...new Set(ms.map(m=>MS[m.c][m.i]))];if(ms.length===1||ms.every(m=>m.k==='out')){play(localPlayer(),S.sel,ms[0]);return}
 if(S.srcs.length===1){selMarble(S.srcs[0].userData.p,S.srcs[0].userData.i,true);return}
 S.stage=3;{const c=S.hands[localPlayer()][S.sel];S.msg=`${c.r}${c.s}: ${HINT[c.r]||c.r+' خطوات'} — اختر الحجر`}draw()}
function burnCard(ci,p=localPlayer()){if(room&&!room.isHost){submitCommand({type:'burn',card:S.hands[p][ci]});return}const cd=S.hands[p].splice(ci,1)[0],f=S.bf;log(`${playerName(p)} حرق ${cd.r}${cd.s} لأن دوره مُنع`);S.phase='play';S.busy=1;S.msg='';draw();later(500,()=>{S.busy=0;nextTurn(f)})}
function burnAI(q){const h=S.hands[q];let b=0;h.forEach((c,k)=>{if(keep(c)<keep(h[b]))b=k});const cd=h.splice(b,1)[0];log(`${playerName(q)} حرق ${cd.r}${cd.s} ومُنع من اللعب`)}
function selMarble(p,i,auto){const ms=S.moves.filter(m=>m.c===p&&m.i===i&&(!S.opt||mkey(m)===S.opt));
 if(ms.length===1&&!auto){play(localPlayer(),S.sel,ms[0]);return}
 clearRings();const seen={};ms.forEach(m=>{const kk=m.k==='swap'?'s'+m.tp+m.tj:m.to;if(!seen[kk]){seen[kk]=1;addRing(m)}});
 S.stage=4;S.msg=S.opts.length>1&&!S.opt?'اختر الوجهة (أو نوع الحركة)':'اختر الوجهة';draw()}
function optClick(k){if(S.busy)return;const o=S.opts[k];S.opt=S.opt===o.key?null:o.key;refreshSrc()}
function cancel(){if(S.cc){S.cc.remove();S.cc=null}clearRings();S.srcs=[];S.opt=null;S.sel=null;S.stage=0;S.msg='';draw()}
function addRing(mv){const v=mv.k==='swap'?P(mv.tp,S.m[mv.tp][mv.tj],mv.tj):P(mv.c,mv.to,mv.i),r=new THREE.Mesh(RGG,RGM);
 r.rotation.x=-Math.PI/2;r.position.set(v.x,BT+.14,v.z);r.userData.mv=mv;scene.add(r);RG.push(r)}
function clearRings(){RG.forEach(r=>scene.remove(r));RG=[]}
function flash(cd){const c=document.createElement('div');c.className='cd cc fl'+(cd.s==='♥'||cd.s==='♦'?' r':'');c.innerHTML=`<b>${cd.r}${cd.s}</b><small>${HINT[cd.r]||cd.r+' خطوات'}</small>`;document.body.appendChild(c);later(1250,()=>c.remove())}
function startTurnClock(key){if(clockKey!==key){clockKey=key;warnedClockKey=''}if(turnClockHandle)return;turnClockHandle=setInterval(()=>{if(!S||S.over||!S.turnAt)return;const left=Math.max(0,10-Math.floor((Date.now()-S.turnAt)/1000));const el=$('turnClock');el.hidden=false;el.textContent=`${left} ث`;el.classList.toggle('urgent',left<5);if(left===5&&warnedClockKey!==clockKey){warnedClockKey=clockKey;SFX.play('warning')}if(left===0&&(room?.isHost||!room)&&(!room||room.isHuman(S.turn))&&!S.busy){const p=S.turn;if(S.phase==='play')cpu(p,true);else if(S.phase==='burn')burnCard(0,p)}},250)}
function draw(){
 if(S){const key=`${S.turnAt||0}:${S.turn}:${S.phase}`;if(S.turn===localSeat&&ownTurnBefore!==key){SFX.play('turn');try{navigator.vibrate?.([120,45,120])}catch(_){}}ownTurnBefore=key;startTurnClock(key)}
 $('turn').innerHTML=S.over?'<b>انتهت اللعبة</b>':`الدور: <b style="color:${HX[S.turn]}">${S.turn===localSeat?'أنت · ':''}${playerName(S.turn)}</b>${S.phase==='xchg'?' · تبادل الأوراق':''}`;
 let sc=[0,0];for(let p=0;p<4;p++)sc[p%2]+=S.m[p].filter(r=>r>=LN).length;
 const team=localPlayer()%2;$('score').textContent=`${isSpectator?'الأزرق والأخضر':'فريقك'}: ${sc[team]}/8 · ${isSpectator?'الأحمر والذهبي':'الفريق الآخر'}: ${sc[1-team]}/8`;
 $('log').replaceChildren(...S.log.map(t=>{const d=document.createElement('div');d.textContent=t;return d}));
 let m=S.msg;if(!m&&!S.over&&S.phase==='play'&&S.turn===localSeat&&!S.busy)m=canMove()?'دورك: اختر ورقة':'لا توجد ورقة تُلعب: اضغط أي ورقة لتُحرق أوراقك كلها';
 let ob='';if(S.stage>=3&&S.opts.length>1)ob=S.opts.map((o,k)=>`<button data-k="${k}" class="${S.opt===o.key?'on':''}">${lab(o,S.hands[localPlayer()][S.sel])}</button>`).join('');
 if(S.stage>=3)ob+='<button class="cx" data-x="1">رجوع</button>';
 const keyboard=S.stage>=3?`<details id="keyboardMoves"><summary>اختيار الحجر والحركة بالأزرار</summary>${S.moves.map((mv,i)=>`<button data-move-index="${i}">${CN[mv.c]} · الحجر ${mv.i+1} · ${mv.k==='out'?'إنزال':mv.k==='swap'?'تبديل مع '+CN[mv.tp]+' '+(mv.tj+1):mv.k==='skip'?'منع التالي':(mv.n||4)+' خطوات'}</button>`).join('')}</details>`:'';$('msg').innerHTML=`<div id="ob">${ob}</div>${keyboard}`;if(m){const text=document.createElement('span');text.textContent=m;$('msg').prepend(text)}
 const n=S.hands[localPlayer()].length;$('hand').innerHTML=(isSpectator?[]:S.hands[localPlayer()]).map((c,i)=>{const red=c.s==='♥'||c.s==='♦',d=i-(n-1)/2;
  return `<button class="cd${S.sel===i&&S.stage?' on':''}${S.dealt?' dl':''}" data-i="${i}" style="--r:${d*7}deg;--y:${Math.abs(d)*6}px;animation-delay:${i*90}ms;background-image:url(${cu(c)})${S.sel===i&&S.stage>=3?';visibility:hidden':''}" title="${c.r}${c.s}: ${HINT[c.r]||c.r+' خطوات'}" aria-label="${c.r} ${c.s}"></button>`}).join('');S.dealt=0;syncStateToFirebase()}
document.addEventListener('pointerdown',()=>SFX.wake(),{once:true});
$('hand').onclick=e=>{const b=e.target.closest('.cd');if(b){SFX.play('tap');pick(+b.dataset.i)}};
$('chatForm').onsubmit=e=>{e.preventDefault();const input=$('chatInput'),value=input.value.trim();if(!value)return;input.value='';sendChatMessage(value)};
$('chatPanel').addEventListener('toggle',()=>{if($('chatPanel').open){const badge=$('chatBadge');badge.hidden=true;badge.textContent='0'}});
$('msg').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.moveIndex!==undefined){const mv=S.moves[+b.dataset.moveIndex];if(mv&&S.turn===localSeat&&!S.busy&&!isSpectator)play(localPlayer(),S.sel,mv);return}if(b.dataset.x)cancel();else optClick(+b.dataset.k)};
/* ---------- المشهد: اللوحة المربعة الكلاسيكية ---------- */
const cv=$('cv'),ren=new THREE.WebGLRenderer({canvas:cv,antialias:true}),scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(45,1,.1,300);
ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;ren.setPixelRatio(Math.min(devicePixelRatio,innerWidth<600?1.5:2));ren.outputEncoding=THREE.sRGBEncoding;ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=1.05;
const lc=h=>new THREE.Color(h).convertSRGBToLinear();scene.background=lc(0x0a0706);
const rnd=Math.random,ZT=10.7,BT=.4,SC=1024/27,OFF=[[-1.5,0],[-1.24,1.24],[1.5,0],[0,1.5]],FX=[],PILE=[],PCOL=[0x1b4fbf,0xc9161e,0x1d8a3e,0xd9a01a];
function tex(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=8;t.encoding=THREE.sRGBEncoding;return t}
const lth=(g,w,h,b,bl)=>{g.fillStyle=b;g.fillRect(0,0,w,h);
 if(bl){for(let i=0;i<w*h/9000;i++){const x=rnd()*w,y=rnd()*h,r=40+rnd()*120,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,rnd()<.5?'rgba(0,0,0,.09)':'rgba(255,190,140,.05)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r)}
  for(let i=0;i<w*h/20;i++){g.fillStyle=rnd()<.55?`rgba(0,0,0,${.03+rnd()*.06})`:`rgba(255,215,170,${.02+rnd()*.04})`;g.fillRect(rnd()*w,rnd()*h,1+rnd()*.8,1+rnd()*.8)}}
 else for(let i=0;i<w*h/160;i++){g.fillStyle=rnd()<.5?`rgba(0,0,0,${rnd()*.1})`:`rgba(255,215,170,${rnd()*.04})`;g.fillRect(rnd()*w,rnd()*h,1+rnd(),1+rnd())}};
/* بيئة استوديو للانعكاسات اللامعة */
try{const es=new THREE.Scene(),et=tex(1024,512,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#2a2a30');gr.addColorStop(.5,'#18161a');gr.addColorStop(1,'#0a0908');g.fillStyle=gr;g.fillRect(0,0,w,h);
 [[.25,.18,260,70,'#ffffff'],[.62,.22,200,60,'#ffe6c4'],[.9,.4,120,150,'#9ac4ff'],[.05,.45,100,160,'#ffd0a0'],[.45,.05,380,40,'#ffffff']].forEach(([x,y,bw,bh,c])=>{g.fillStyle=c;g.fillRect(x*w-bw/2,y*h-bh/2,bw,bh)})});
 es.add(new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.MeshBasicMaterial({map:et,side:THREE.BackSide})));const generator=new THREE.PMREMGenerator(ren);scene.environment=generator.fromScene(es,.03).texture;generator.dispose();es.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});et.dispose()}catch(e){}
scene.add(new THREE.AmbientLight(0xffffff,.32));
const dl=new THREE.DirectionalLight(0xffe2c0,1.5);dl.position.set(8,24,12);dl.castShadow=true;dl.shadow.mapSize.set(innerWidth<600?1024:2048,innerWidth<600?1024:2048);dl.shadow.radius=4;dl.shadow.bias=-.0004;Object.assign(dl.shadow.camera,{left:-18,right:18,top:18,bottom:-18});scene.add(dl);
const rl=new THREE.DirectionalLight(0x6fa8ff,.6);rl.position.set(-14,10,-18);scene.add(rl);
const pl=new THREE.PointLight(0xffc27a,.45,70);pl.position.set(0,12,0);scene.add(pl);
/* هندسة الثقوب (76 ثقباً كما في اللوح الحقيقي) */
const rot=(p,x,z)=>{for(let k=0;k<p;k++)[x,z]=[-z,x];return[x,z]};
function trf(i){i=(i%76+76)%76;const b=i/19|0,j=i%19;let a=b,x,z;
 if(j<=5){x=-2;z=ZT-j}else if(j<=9){const t=(j-5)/5,y=ZT-5;x=-2*(1-t)-y*t;z=y*(1-t)+2*t}else{a=b+1;if(j<=14){x=2;z=ZT-15+j}else{x=17-j;z=ZT}}
 return{a,x,z,j}}
const tr=i=>{const f=trf(i);return rot(f.a,f.x,f.z)};
function P(p,r,i){let a;if(r<=Y)a=rot(p,i-1.5,ZT-6.2);else if(r>=LN)a=rot(p,0,ZT-1-(r-LN));else a=tr(E[p]+r);return new THREE.Vector3(a[0],BT+.06,a[1])}
const PT=[];for(let i=0;i<N;i++)PT.push(tr(i));
const OP=d=>PT.map((p,i)=>{const a=PT[(i+N-1)%N],b=PT[(i+1)%N],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return[p[0]+dz/l*d,p[1]-dx/l*d]});
/* جلد البورد: قناة غائرة، خياطة، ثقوب، أرقام، نجمة */
const X=x=>512+x*SC,Zc=z=>512+z*SC;
const bt=tex(2048,2048,g=>{const back=g.createLinearGradient(0,0,2048,2048);back.addColorStop(0,'#111c29');back.addColorStop(.5,'#182735');back.addColorStop(1,'#101a26');g.fillStyle=back;g.fillRect(0,0,2048,2048);g.scale(2,2);g.lineJoin='round';g.lineCap='round';
 for(let k=1;k<32;k++){g.strokeStyle='rgba(129,164,180,.035)';g.lineWidth=1;g.beginPath();g.moveTo(k*32,0);g.lineTo(k*32,1024);g.moveTo(0,k*32);g.lineTo(1024,k*32);g.stroke()}
 const path=(pts,cl)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));if(cl)g.closePath()},px=d=>OP(d).map(p=>[X(p[0]),Zc(p[1])]);
 path(PT.map(p=>[X(p[0]),Zc(p[1])]),1);g.fillStyle='#1a2b39';g.fill();g.strokeStyle='rgba(76,220,202,.5)';g.lineWidth=1.95*SC;g.stroke();g.strokeStyle='#243b4a';g.lineWidth=1.72*SC;g.stroke();g.strokeStyle='rgba(3,10,18,.48)';g.lineWidth=1.45*SC;g.stroke();
 g.fillStyle='#142331';
 for(let p=0;p<4;p++){let[cx,cz]=rot(p,0,ZT-2.5);g.save();g.translate(X(cx),Zc(cz));g.rotate(p*Math.PI/2);g.fillRect(-.82*SC,-2.9*SC,1.64*SC,5.8*SC);g.restore();
  [cx,cz]=rot(p,0,ZT-6.2);g.save();g.translate(X(cx),Zc(cz));g.rotate(p*Math.PI/2);g.fillRect(-2.5*SC,-.82*SC,5*SC,1.64*SC);g.restore()}
 let gr=g.createRadialGradient(512,512,SC,512,512,3.9*SC);gr.addColorStop(0,'#273c4b');gr.addColorStop(1,'#142330');g.fillStyle=gr;g.beginPath();g.arc(512,512,3.9*SC,0,7);g.fill();g.strokeStyle='rgba(87,220,203,.7)';g.lineWidth=5;g.stroke();
 const star=(R,r)=>{g.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,q=k%2?r:R;g.lineTo(512+q*Math.cos(a),512+q*Math.sin(a))}g.closePath()};
 g.save();g.shadowColor='rgba(0,0,0,.45)';g.shadowBlur=18;gr=g.createLinearGradient(512-3*SC,512-3*SC,512+3*SC,512+3*SC);gr.addColorStop(0,'#f4fbff');gr.addColorStop(1,'#8ca7b8');g.fillStyle=gr;star(2.7*SC,1.16*SC);g.fill();g.restore();
 g.strokeStyle='#55d7c4';g.lineWidth=3;star(2.7*SC,1.16*SC);g.stroke();
 const st=(pts,cl)=>{path(pts,cl);g.setLineDash([12,9]);g.lineWidth=2.2;g.save();g.translate(0,2);g.strokeStyle='rgba(0,0,0,.4)';g.stroke();g.restore();g.strokeStyle='#7693a2';g.stroke();g.lineWidth=1;g.strokeStyle='rgba(162,210,216,.48)';g.stroke();g.setLineDash([])};
 st(px(1.05),1);st(px(-1.05),1);st([[30,30],[994,30],[994,994],[30,994]],1);st([[48,48],[976,48],[976,976],[48,976]],1);
 g.beginPath();g.arc(512,512,3.62*SC,0,7);g.setLineDash([4,10]);g.lineWidth=2.2;g.strokeStyle='#55d7c4';g.stroke();g.setLineDash([]);
 const hl=(x,z)=>{const c=g.createRadialGradient(X(x),Zc(z),.3*SC,X(x),Zc(z),.6*SC);c.addColorStop(0,'rgba(0,0,0,.7)');c.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=c;g.beginPath();g.arc(X(x),Zc(z),.6*SC,0,7);g.fill()};
 for(let i=0;i<N;i++){const[x,z]=tr(i);hl(x,z);g.setLineDash([3,5]);g.lineWidth=2.1;g.strokeStyle='#7894a2';g.beginPath();g.arc(X(x),Zc(z),.47*SC,0,7);g.stroke();g.setLineDash([])}
 for(let p=0;p<4;p++)for(let k=0;k<4;k++){let v=P(p,LN+k,0);hl(v.x,v.z);v=P(p,Y,k);hl(v.x,v.z)}
 g.fillStyle='#b5c8d1';g.font='bold 18px Arial';g.textAlign='center';g.textBaseline='middle';g.shadowColor='rgba(0,0,0,.65)';g.shadowBlur=3;g.shadowOffsetY=1;
 for(let i=0;i<N;i++){const f=trf(i);if(!f.j)continue;const o=OFF[f.j<=5?0:f.j<=9?1:f.j<=14?2:3],[lx,lz]=rot(f.a,f.x+o[0],f.z+o[1]);g.save();g.translate(X(lx),Zc(lz));g.rotate(f.a*Math.PI/2);g.fillText(f.j,0,1);g.restore()}});
/* خريطة ارتفاع: قناة غائرة، حواف جلدية منتفخة، ثقوب عميقة بحافة مشطوفة، خياطة ونجمة بارزة */
const hm=tex(1024,1024,g=>{g.fillStyle='#808080';g.fillRect(0,0,1024,1024);
 const P2=PT.map(p=>[X(p[0]),Zc(p[1])]),pth=()=>{g.beginPath();P2.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()};
 g.lineJoin='round';g.lineCap='round';
 g.save();g.shadowColor='#d8d8d8';g.shadowBlur=30;pth();g.strokeStyle='#d0d0d0';g.lineWidth=2.25*SC;g.stroke();g.restore();
 g.save();g.shadowColor='#0c0c0c';g.shadowBlur=16;pth();g.strokeStyle='#1c1c1c';g.lineWidth=1.6*SC;g.stroke();g.restore();
 g.fillStyle='#202020';for(let p=0;p<4;p++){let[cx,cz]=rot(p,0,ZT-2.5);g.save();g.translate(X(cx),Zc(cz));g.rotate(p*Math.PI/2);g.fillRect(-.82*SC,-2.9*SC,1.64*SC,5.8*SC);g.restore();[cx,cz]=rot(p,0,ZT-6.2);g.save();g.translate(X(cx),Zc(cz));g.rotate(p*Math.PI/2);g.fillRect(-2.5*SC,-.82*SC,5*SC,1.64*SC);g.restore()}
 g.beginPath();g.arc(512,512,3.9*SC,0,7);g.fillStyle='#303030';g.fill();
 g.save();g.shadowColor='#f0f0f0';g.shadowBlur=14;g.fillStyle='#d8d8d8';g.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,q=k%2?1.3*SC:3*SC;g.lineTo(512+q*Math.cos(a),512+q*Math.sin(a))}g.closePath();g.fill();g.restore();
 const hole=(x,z)=>{const c=g.createRadialGradient(X(x),Zc(z),.15*SC,X(x),Zc(z),.5*SC);c.addColorStop(0,'#000');c.addColorStop(.66,'#050505');c.addColorStop(.82,'#a8a8a8');c.addColorStop(1,'rgba(128,128,128,0)');g.fillStyle=c;g.beginPath();g.arc(X(x),Zc(z),.5*SC,0,7);g.fill()};
 for(let i=0;i<N;i++){const[x,z]=tr(i);hole(x,z)}
 for(let p=0;p<4;p++)for(let k=0;k<4;k++){let v=P(p,LN+k,0);hole(v.x,v.z);v=P(p,Y,k);hole(v.x,v.z)}
 g.setLineDash([10,7]);g.lineWidth=3.6;g.strokeStyle='#b8b8b8';
 for(const d of[1.05,-1.05]){g.beginPath();OP(d).forEach((p,i)=>i?g.lineTo(X(p[0]),Zc(p[1])):g.moveTo(X(p[0]),Zc(p[1])));g.closePath();g.stroke()}
 g.strokeRect(30,30,964,964);g.strokeRect(48,48,928,928)});
hm.encoding=THREE.LinearEncoding;
const sideM=new THREE.MeshStandardMaterial({map:tex(256,256,(g,w,h)=>{g.fillStyle='#152432';g.fillRect(0,0,w,h);g.strokeStyle='rgba(87,215,196,.18)';g.lineWidth=2;for(let y=0;y<h;y+=18){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}}),roughness:.48,metalness:.35,envMapIntensity:.45});
const board=new THREE.Mesh(new THREE.BoxGeometry(27,.8,27),[sideM,sideM,new THREE.MeshPhysicalMaterial({map:bt,bumpMap:hm,bumpScale:.8,roughness:.58,clearcoat:.08,clearcoatRoughness:.55,envMapIntensity:.35}),sideM,sideM,sideM]);board.receiveShadow=true;scene.add(board);
const pipM=new THREE.MeshPhysicalMaterial({color:lc(0x1b3040),roughness:.32,metalness:.6,clearcoat:.5,envMapIntensity:.5});
[[0,-13.6,27.6,.34],[0,13.6,27.6,.34],[-13.6,0,.34,27.6],[13.6,0,.34,27.6]].forEach(([x,z,w,d])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,.3,d),pipM);m.position.set(x,BT-.05,z);m.castShadow=true;scene.add(m)});
const tb=new THREE.Mesh(new THREE.BoxGeometry(80,1,80),new THREE.MeshStandardMaterial({map:tex(1024,1024,(g,w,h)=>{lth(g,w,h,'#140d0a');const gr=g.createRadialGradient(w/2,h/2,w*.12,w/2,h/2,w*.5);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.9)');g.fillStyle=gr;g.fillRect(0,0,w,h)}),roughness:.8,envMapIntensity:.2}));tb.position.y=-.9;tb.receiveShadow=true;scene.add(tb);
const chrome=new THREE.MeshStandardMaterial({color:lc(0x76d9cb),metalness:.72,roughness:.28});
const cr=new THREE.Mesh(new THREE.TorusGeometry(3.9,.09,10,72),chrome);cr.rotation.x=Math.PI/2;cr.position.y=BT+.03;scene.add(cr);
/* أوسمة لونية في الزوايا */
function medal(x,z,p){const top=new THREE.MeshStandardMaterial({map:tex(256,256,g=>{const gr=g.createRadialGradient(128,128,10,128,128,128);gr.addColorStop(0,'#'+PCOL[p].toString(16).padStart(6,'0'));gr.addColorStop(1,'#101010');g.fillStyle=gr;g.fillRect(0,0,256,256);g.fillStyle='#e8dcc0';g.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,r=k%2?36:88;g.lineTo(128+r*Math.cos(a),128+r*Math.sin(a))}g.closePath();g.fill()}),metalness:.5,roughness:.35}),
 m=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,.14,48),[chrome,top,chrome]),t=new THREE.Mesh(new THREE.TorusGeometry(1.55,.07,10,48),chrome);m.position.set(x,BT+.07,z);m.castShadow=true;t.rotation.x=Math.PI/2;t.position.set(x,BT+.14,z);scene.add(m,t)}
medal(-8,-8,1);medal(8,-8,2);medal(-8,8,0);medal(8,8,3);
/* نيون: حواف قناة المسار + ممرات بر الأمان */
function tube(cu,r,mat){const m=new THREE.Mesh(new THREE.TubeGeometry(cu,380,r,8,true),mat);scene.add(m);return m}
const NL=[.9,-.9].map(d=>{const cu=new THREE.CatmullRomCurve3(OP(d).map(p=>new THREE.Vector3(p[0],BT+.09,p[1])),true);
 return{core:tube(cu,.026,new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})),halo:tube(cu,.1,new THREE.MeshBasicMaterial({color:lc(0x66aaff),transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}))}});
const LNN=[0,1,2,3].map(p=>[-.62,.62].map(sx=>{const[nx,nz]=rot(p,sx,ZT-2.5),g=new THREE.Group();g.position.set(nx,BT+.08,nz);g.rotation.y=p*Math.PI/2;
 const core=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,4.9,8),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})),halo=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,4.9,10),new THREE.MeshBasicMaterial({color:lc(COL[p]),transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
 core.rotation.x=halo.rotation.x=Math.PI/2;g.add(core,halo);scene.add(g);return halo}));
for(let p=0;p<4;p++){const[dx,dz]=rot(p,0,ZT-6.2),pd=new THREE.Mesh(new THREE.BoxGeometry(4.6,.04,1.5),new THREE.MeshStandardMaterial({color:lc(COL[p]),transparent:true,opacity:.22,emissive:lc(COL[p]),emissiveIntensity:.25}));pd.position.set(dx,BT+.01,dz);pd.rotation.y=p*Math.PI/2;scene.add(pd)}
const NL2=[.9,-.9].map(d=>tube(new THREE.CatmullRomCurve3(OP(d).map(p=>new THREE.Vector3(p[0],BT+.09,p[1])),true),.19,new THREE.MeshBasicMaterial({color:lc(0x66aaff),transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false})));
const tcol=new THREE.Color();
function neonUpdate(t){tcol.setHex(S&&!S.over?COL[S.turn]:0x66aaff).convertSRGBToLinear();NL2.forEach(m=>{m.material.color.copy(tcol);m.material.opacity=.1+.05*Math.sin(t*3)});NL.forEach(n=>{n.halo.material.color.copy(tcol);n.halo.material.opacity=.3+.12*Math.sin(t*3);n.core.material.color.setHex(0xffffff).lerp(tcol,.4)});
 LNN.forEach((a,p)=>a.forEach(h=>h.material.opacity=S&&S.turn===p&&!S.over?.4+.2*Math.sin(t*5):.22))}
/* الثقوب: حافة جلدية وداخل غائر */
const GD=new THREE.CircleGeometry(.34,28),hM=new THREE.MeshStandardMaterial({color:lc(0x0b1626),roughness:.5,metalness:.2,envMapIntensity:.4}),lipM=new THREE.MeshStandardMaterial({color:lc(0x426273),roughness:.38,metalness:.45,envMapIntensity:.4}),hG=new THREE.CylinderGeometry(.37,.37,.1,32),lipG=new THREE.TorusGeometry(.4,.04,8,32);
const hole=(x,z,m)=>{const a=new THREE.Mesh(hG,m||hM);a.position.set(x,BT-.02,z);scene.add(a);const b=new THREE.Mesh(lipG,lipM);b.rotation.x=Math.PI/2;b.position.set(x,BT+.035,z);scene.add(b)};
const rg=(c,r,y,x,z)=>{const o=new THREE.Mesh(new THREE.TorusGeometry(r,.04,8,28),new THREE.MeshStandardMaterial({color:lc(c),emissive:lc(c),emissiveIntensity:.6,toneMapped:false}));o.rotation.x=Math.PI/2;o.position.set(x,y,z);scene.add(o)};
for(let i=0;i<N;i++){const f=trf(i),[x,z]=rot(f.a,f.x,f.z);hole(x,z);if(!f.j)rg(COL[f.a],.45,BT+.06,x,z)}
for(let p=0;p<4;p++){const lm=new THREE.MeshStandardMaterial({color:lc(PCOL[p]),emissive:lc(COL[p]),emissiveIntensity:.14,roughness:.3,metalness:.3});
 for(let k=0;k<4;k++){const v=P(p,LN+k,0),w=P(p,Y,k),gl=new THREE.Mesh(GD,new THREE.MeshBasicMaterial({color:lc(COL[p]),transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));hole(v.x,v.z);hole(w.x,w.z);rg(COL[p],.45,BT+.07,v.x,v.z);gl.rotation.x=-Math.PI/2;gl.position.set(v.x,BT+.045,v.z);scene.add(gl)}}
const RGG=new THREE.RingGeometry(.48,.62,32),RGM=new THREE.MeshBasicMaterial({color:lc(0xffd54a),side:THREE.DoubleSide,toneMapped:false});
function ringFx(v,c){const m=new THREE.Mesh(new THREE.TorusGeometry(.5,.06,8,32),new THREE.MeshBasicMaterial({color:lc(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.rotation.x=Math.PI/2;m.position.set(v.x,BT+.08,v.z);scene.add(m);FX.push({m,a:0})}
/* أوراق لعب عالية الجودة: ورق مصقول بزوايا مدورة وسماكة، نقاط دقيقة، صور الشيخ والبنت والولد مفصّلة */
const CC={},CU={},CW=2.5,CH=3.5;
function rrect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
const SUITP={'♥':(g,s)=>{g.moveTo(0,s*.95);g.bezierCurveTo(-s*1.3,s*.15,-s*.95,-s*.95,0,-s*.38);g.bezierCurveTo(s*.95,-s*.95,s*1.3,s*.15,0,s*.95)},
 '♦':(g,s)=>{g.moveTo(0,-s);g.quadraticCurveTo(s*.25,-s*.28,s*.72,0);g.quadraticCurveTo(s*.25,s*.28,0,s);g.quadraticCurveTo(-s*.25,s*.28,-s*.72,0);g.quadraticCurveTo(-s*.25,-s*.28,0,-s)},
 '♠':(g,s)=>{g.moveTo(0,-s);g.bezierCurveTo(s*1.35,-s*.05,s*.9,s*.8,0,s*.4);g.bezierCurveTo(-s*.9,s*.8,-s*1.35,-s*.05,0,-s);g.moveTo(0,s*.2);g.lineTo(s*.34,s);g.lineTo(-s*.34,s);g.closePath()},
 '♣':(g,s)=>{for(const[x,y]of[[0,-.46],[-.5,.12],[.5,.12]]){g.moveTo(x*s+s*.44,y*s);g.arc(x*s,y*s,s*.44,0,7)}g.moveTo(0,s*.1);g.lineTo(s*.3,s);g.lineTo(-s*.3,s);g.closePath()}};
function drawSuit(g,x,y,s,suit,flip,col){g.save();g.translate(x,y);if(flip)g.rotate(Math.PI);g.beginPath();SUITP[suit](g,s);const gr=g.createLinearGradient(-s,-s,s,s);gr.addColorStop(0,col);gr.addColorStop(1,col);g.fillStyle=col;g.fill();g.restore()}
const PIPS={A:[[.5,.5]],2:[[.5,.2],[.5,.8]],3:[[.5,.2],[.5,.5],[.5,.8]],4:[[.3,.2],[.7,.2],[.3,.8],[.7,.8]],5:[[.3,.2],[.7,.2],[.5,.5],[.3,.8],[.7,.8]],6:[[.3,.2],[.7,.2],[.3,.5],[.7,.5],[.3,.8],[.7,.8]]};
PIPS[7]=[...PIPS[6],[.5,.35]];PIPS[8]=[...PIPS[6],[.5,.35],[.5,.65]];PIPS[9]=[[.3,.2],[.7,.2],[.3,.4],[.7,.4],[.3,.6],[.7,.6],[.3,.8],[.7,.8],[.5,.5]];PIPS[10]=[[.3,.2],[.7,.2],[.3,.4],[.7,.4],[.3,.6],[.7,.6],[.3,.8],[.7,.8],[.5,.3],[.5,.7]];
function court(g,W,H,r,suit){const x0=W*.22,y0=H*.14,w=W*.56,h=H*.72,cx=W/2,C={K:['#1c3f8f','#b91c2a'],Q:['#6d1a55','#cfa23a'],J:['#b91c2a','#1d5f93']}[r],gold='#e2b64a',ol='#3b2412';
 const bg=g.createLinearGradient(x0,y0,x0+w,y0+h);bg.addColorStop(0,'#f6ebcd');bg.addColorStop(1,'#e9d8a8');rrect(g,x0,y0,w,h,10);g.fillStyle=bg;g.fill();
 g.save();rrect(g,x0,y0,w,h,10);g.clip();g.strokeStyle='rgba(150,110,50,.12)';g.lineWidth=1.2;for(let k=-h;k<w+h;k+=15){g.beginPath();g.moveTo(x0+k,y0);g.lineTo(x0+k+h,y0+h);g.stroke()}
 for(const fl of[0,1]){g.save();g.translate(cx,H/2);if(fl)g.rotate(Math.PI);g.translate(-cx,-H/2);
  g.beginPath();g.moveTo(cx-w*.48,H/2);g.quadraticCurveTo(cx-w*.46,H*.34,cx-w*.16,H*.35);g.lineTo(cx+w*.16,H*.35);g.quadraticCurveTo(cx+w*.46,H*.34,cx+w*.48,H/2);g.closePath();g.fillStyle=C[0];g.fill();g.lineWidth=2.2;g.strokeStyle=ol;g.stroke();
  g.save();g.clip();g.fillStyle=C[1];g.fillRect(cx,H*.3,w,H*.3);g.strokeStyle='rgba(255,240,200,.35)';g.lineWidth=1.5;for(let i=-4;i<8;i++){g.beginPath();g.moveTo(cx-w*.5+i*18,H/2);g.lineTo(cx-w*.5+i*18+30,H*.37);g.moveTo(cx-w*.5+i*18,H*.37);g.lineTo(cx-w*.5+i*18+30,H/2);g.stroke()}g.restore();
  g.strokeStyle=gold;g.lineWidth=3;g.beginPath();g.moveTo(cx,H*.355);g.lineTo(cx,H/2);g.moveTo(cx-w*.36,H/2);g.lineTo(cx-w*.2,H*.39);g.moveTo(cx+w*.36,H/2);g.lineTo(cx+w*.2,H*.39);g.stroke();
  g.fillStyle='#f8f4ea';g.beginPath();g.ellipse(cx,H*.352,w*.2,H*.03,0,0,7);g.fill();g.lineWidth=1.8;g.strokeStyle=ol;g.stroke();g.fillStyle='#222';for(let i=-3;i<=3;i++)g.fillRect(cx+i*w*.05-1.5,H*.346,3,H*.012);
  drawSuit(g,cx,H*.445,W*.036,suit,false,gold);
  if(r==='Q'){g.fillStyle='#5a3418';g.beginPath();g.ellipse(cx-W*.08,H*.31,W*.035,H*.07,0,0,7);g.ellipse(cx+W*.08,H*.31,W*.035,H*.07,0,0,7);g.fill();g.stroke()}
  else{g.fillStyle=r==='K'?'#7a7a82':'#6a4020';g.beginPath();g.ellipse(cx,H*.275,W*.085,H*.045,0,0,7);g.fill()}
  g.fillStyle='#e6bd92';g.fillRect(cx-w*.04,H*.325,w*.08,H*.04);
  g.beginPath();g.arc(cx,H*.29,W*.07,0,7);g.fillStyle='#f2cfa5';g.fill();g.lineWidth=2;g.strokeStyle=ol;g.stroke();
  g.fillStyle='#2d2018';g.beginPath();g.ellipse(cx-W*.027,H*.285,2.8,2,0,0,7);g.ellipse(cx+W*.027,H*.285,2.8,2,0,0,7);g.fill();
  g.strokeStyle='#5a3418';g.lineWidth=1.8;g.beginPath();g.moveTo(cx-W*.04,H*.272);g.lineTo(cx-W*.016,H*.268);g.moveTo(cx+W*.016,H*.268);g.lineTo(cx+W*.04,H*.272);g.moveTo(cx,H*.287);g.lineTo(cx-W*.006,H*.302);g.lineTo(cx+W*.004,H*.303);g.stroke();
  g.strokeStyle='#a0442d';g.lineWidth=2;g.beginPath();g.moveTo(cx-W*.02,H*.314);g.quadraticCurveTo(cx,H*.32,cx+W*.02,H*.314);g.stroke();
  if(r==='K'){g.fillStyle='#8c8c94';g.beginPath();g.moveTo(cx-W*.065,H*.3);g.quadraticCurveTo(cx,H*.39,cx+W*.065,H*.3);g.quadraticCurveTo(cx,H*.332,cx-W*.065,H*.3);g.fill();g.lineWidth=1.8;g.strokeStyle=ol;g.stroke()}
  g.lineWidth=2;g.strokeStyle=ol;
  if(r==='J'){g.beginPath();g.ellipse(cx,H*.232,W*.095,H*.03,-.1,0,7);g.fillStyle=C[1];g.fill();g.stroke();g.strokeStyle=gold;g.lineWidth=4;g.beginPath();g.moveTo(cx+W*.07,H*.226);g.quadraticCurveTo(cx+W*.14,H*.2,cx+W*.15,H*.16);g.stroke()}
  else{const k=r==='K'?1:.82;g.beginPath();g.moveTo(cx-W*.075*k,H*.24);g.lineTo(cx-W*.078*k,H*.188);g.lineTo(cx-W*.04*k,H*.212);g.lineTo(cx,H*.168);g.lineTo(cx+W*.04*k,H*.212);g.lineTo(cx+W*.078*k,H*.188);g.lineTo(cx+W*.075*k,H*.24);g.closePath();g.fillStyle=gold;g.fill();g.stroke();
   for(const[jx,jy,jc]of[[0,.2,'#c4202b'],[-.05,.225,'#1d5f93'],[.05,.225,'#1d5f93']]){g.beginPath();g.arc(cx+W*jx*k,H*jy,3,0,7);g.fillStyle=jc;g.fill()}}
  if(r==='Q'){g.strokeStyle='#2f6b2a';g.lineWidth=3;g.beginPath();g.moveTo(cx+w*.33,H*.49);g.lineTo(cx+w*.33,H*.38);g.stroke();g.fillStyle='#c4202b';for(let a=0;a<5;a++){g.beginPath();g.arc(cx+w*.33+Math.cos(a*1.26)*6,H*.36+Math.sin(a*1.26)*6,5,0,7);g.fill()}g.beginPath();g.arc(cx+w*.33,H*.36,4,0,7);g.fillStyle='#f0c050';g.fill()}
  else{g.strokeStyle='#c8ccd2';g.lineWidth=6;g.beginPath();g.moveTo(cx+w*.34,H*.47);g.lineTo(cx+w*.34,H*.22);g.stroke();g.strokeStyle=gold;g.lineWidth=7;g.beginPath();g.moveTo(cx+w*.28,H*.43);g.lineTo(cx+w*.4,H*.43);g.stroke()}
  g.restore()}
 g.restore();g.lineWidth=4;g.strokeStyle='#b88a3a';rrect(g,x0,y0,w,h,10);g.stroke();g.lineWidth=1.5;g.strokeStyle='#d8b45a';rrect(g,x0+6,y0+6,w-12,h-12,6);g.stroke();g.lineWidth=3;g.strokeStyle='#b88a3a';g.beginPath();g.moveTo(x0,H/2);g.lineTo(x0+w,H/2);g.stroke()}
function drawFace(g,W,H,cd){const ink=cd.s==='♥'||cd.s==='♦'?'#c4202b':'#17171c',r=cd.r;
 rrect(g,0,0,W,H,26);g.fillStyle='#f8f4ea';g.fill();g.save();rrect(g,0,0,W,H,26);g.clip();
 for(let i=0;i<3200;i++){g.fillStyle=`rgba(110,90,60,${rnd()*.05})`;g.fillRect(rnd()*W,rnd()*H,1+rnd()*1.5,1)}
 for(let i=0;i<60;i++){g.strokeStyle=`rgba(120,100,70,${rnd()*.05})`;g.lineWidth=1;g.beginPath();const x=rnd()*W,y=rnd()*H;g.moveTo(x,y);g.lineTo(x+rnd()*14-7,y+rnd()*14-7);g.stroke()}
 const eg=g.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.75);eg.addColorStop(0,'rgba(0,0,0,0)');eg.addColorStop(1,'rgba(90,70,40,.13)');g.fillStyle=eg;g.fillRect(0,0,W,H);g.restore();
 g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';g.font=`bold ${r==='10'?58:70}px "Times New Roman",Georgia,serif`;
 for(const fl of[0,1]){g.save();g.translate(fl?W*.9:W*.1,fl?H*.925:H*.075);if(fl)g.rotate(Math.PI);g.fillText(r,0,0);drawSuit(g,0,H*.088,W*.045,cd.s,false,ink);g.restore()}
 if('JQK'.includes(r))court(g,W,H,r,cd.s);else PIPS[r].forEach(([fx,fy])=>drawSuit(g,W*fx,H*(.14+.72*fy),r==='A'?W*.22:(+r>=8?W*.078:W*.088),cd.s,fy>.5,ink))}
function cardBack(){const W=400,H=560,c=document.createElement('canvas');c.width=640;c.height=896;const g=c.getContext('2d');g.scale(1.6,1.6);
 rrect(g,0,0,W,H,26);g.fillStyle='#f8f4ea';g.fill();rrect(g,22,22,W-44,H-44,14);g.fillStyle='#7d1822';g.fill();g.save();rrect(g,22,22,W-44,H-44,14);g.clip();
 g.strokeStyle='rgba(224,184,110,.5)';g.lineWidth=2;for(let k=-H;k<W+H;k+=26){g.beginPath();g.moveTo(k,0);g.lineTo(k+H,H);g.moveTo(k+H,0);g.lineTo(k,H);g.stroke()}
 g.fillStyle='rgba(224,184,110,.4)';for(let x=13;x<W;x+=26)for(let y=13;y<H;y+=26){g.beginPath();g.arc(x,y,2.2,0,7);g.fill()}g.restore();
 rrect(g,38,38,W-76,H-76,10);g.lineWidth=3;g.strokeStyle='#e0b86e';g.stroke();rrect(g,46,46,W-92,H-92,8);g.lineWidth=1.5;g.stroke();
 g.beginPath();g.arc(W/2,H/2,96,0,7);g.fillStyle='#5c1019';g.fill();g.lineWidth=4;g.strokeStyle='#e0b86e';g.stroke();g.beginPath();g.arc(W/2,H/2,84,0,7);g.lineWidth=1.5;g.stroke();
 g.fillStyle='#e0b86e';g.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,q=k%2?32:74;g.lineTo(W/2+q*Math.cos(a),H/2+q*Math.sin(a))}g.closePath();g.fill();return c}
function cardCanvas(cd){const k=cd.r+cd.s;if(CC[k])return CC[k];const c=document.createElement('canvas');c.width=640;c.height=896;const g=c.getContext('2d');g.scale(1.6,1.6);drawFace(g,400,560,cd);return CC[k]=c}
const cu=c=>{const k=c.r+c.s;if(!CU[k]){const s=document.createElement('canvas');s.width=360;s.height=504;s.getContext('2d').drawImage(cardCanvas(c),0,0,360,504);CU[k]=s.toDataURL('image/webp',.92)}return CU[k]};
function rrShape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}
const cSh=rrShape(CW,CH,.19),eG=new THREE.ExtrudeGeometry(cSh,{depth:.04,bevelEnabled:false,curveSegments:10}),fG=new THREE.ShapeGeometry(cSh,10);
{const u=fG.attributes.uv,p=fG.attributes.position;for(let i=0;i<u.count;i++)u.setXY(i,(p.getX(i)+CW/2)/CW,(p.getY(i)+CH/2)/CH)}
const BKT=new THREE.CanvasTexture(cardBack());BKT.encoding=THREE.sRGBEncoding;BKT.anisotropy=8;
const eM=new THREE.MeshStandardMaterial({color:lc(0xe9e3d3),roughness:.7}),bM=new THREE.MeshPhysicalMaterial({map:BKT,roughness:.4,clearcoat:.5,clearcoatRoughness:.25,envMapIntensity:.4});
function makeCard(cd){const m=new THREE.Group(),n=new THREE.Group(),t=new THREE.CanvasTexture(cardCanvas(cd));t.encoding=THREE.sRGBEncoding;t.anisotropy=8;
 const f=new THREE.Mesh(fG,new THREE.MeshPhysicalMaterial({map:t,roughness:.38,clearcoat:.5,clearcoatRoughness:.25,envMapIntensity:.5})),b=new THREE.Mesh(fG,bM),e=new THREE.Mesh(eG,eM);
 f.position.z=.041;b.rotation.y=Math.PI;b.position.z=-.001;e.castShadow=true;n.add(e,f,b);n.rotation.x=-Math.PI/2;m.add(n);m.userData.tex=t;return m}
function disposeCard(o){scene.remove(o);TW=TW.filter(w=>w.o!==o);if(o.userData.tex)o.userData.tex.dispose();o.traverse(c=>{if(c.isMesh&&c.material!==bM&&c.material!==eM)c.material.dispose()})}
function centerCard(cd,p,m0){const m=m0||makeCard(cd),s=rot(p,0,15);if(!m0){m.position.set(s[0],6,s[1]);m.rotation.set(0,seatAngle(p),0);scene.add(m)}
 PILE.push(m);while(PILE.length>6)disposeCard(PILE.shift());
 const ox=(rnd()-.5)*.5,oz=(rnd()-.5)*.5;PILE.forEach((c,k)=>{c.userData.ty=BT+.2+k*.06;if(c!==m)c.position.y=c.userData.ty});
 fly(m,new THREE.Vector3(ox,m.userData.ty,oz),.8,0,2.6,null,new THREE.Euler(0,seatAngle(p),0))}
function toCenter(ci){const cd=S.hands[localPlayer()][ci];if(!cd)return;const m=makeCard(cd),st=rot(0,0,16);m.position.set(st[0],5,st[1]);scene.add(m);
 fly(m,new THREE.Vector3(0,3.1,.2),.55,0,1.2,null,new THREE.Euler(.55,seatAngle(localPlayer()),0));S.cc={mesh:m,remove(){disposeCard(m)},style:{}}}
/* أحجار على شكل بيدق معدني لامع */
const PG=new THREE.LatheGeometry([[0,0],[.40,0],[.41,.04],[.39,.08],[.40,.10],[.37,.14],[.34,.17],[.30,.19],[.22,.23],[.15,.32],[.12,.46],[.11,.56],[.19,.58],[.26,.61],[.27,.65],[.2,.68],[.12,.7],[.1,.74]].map(([x,y])=>new THREE.Vector2(x,y)),32),HG=new THREE.SphereGeometry(.27,32,20),RG1=new THREE.TorusGeometry(.39,.03,8,32),RG2=new THREE.TorusGeometry(.275,.025,8,28);
function pawn(p,i){const mat=new THREE.MeshPhysicalMaterial({color:lc(PCOL[p]),metalness:.9,roughness:.2,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.5,emissive:lc(PCOL[p]),emissiveIntensity:.08}),g=new THREE.Group();g.userData={p,i};g.mat=mat;
 const b=new THREE.Mesh(PG,mat),h=new THREE.Mesh(HG,mat),r1=new THREE.Mesh(RG1,chrome),r2=new THREE.Mesh(RG2,chrome);h.position.y=.99;r1.rotation.x=r2.rotation.x=Math.PI/2;r1.position.y=.06;r2.position.y=.61;g.scale.setScalar(1.14);
 [b,h,r1,r2].forEach(m=>{m.castShadow=true;m.userData=g.userData;g.add(m)});scene.add(g);return g}
for(let p=0;p<4;p++){MS[p]=[];for(let i=0;i<4;i++)MS[p][i]=pawn(p,i)}
/* ---------- الحركة والجسيمات ---------- */
function fly(o,to,d,del,a,cb,rt){TW.push({o,f:o.position.clone(),t:to.clone(),d,del,a,e:0,cb,rt:rt||null,rf:rt?o.rotation.clone():null})}
function burst(v,col,n,sz){const g=new THREE.BufferGeometry(),pos=new Float32Array(n*3),vel=[];
 for(let i=0;i<n;i++){pos.set([v.x,v.y,v.z],i*3);vel.push(new THREE.Vector3((Math.random()-.5)*5,Math.random()*4+1,(Math.random()-.5)*5))}
 g.setAttribute('position',new THREE.BufferAttribute(pos,3));
 const pt=new THREE.Points(g,new THREE.PointsMaterial({color:lc(col),size:sz,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(pt);PS.push({pt,vel,age:0})}
function anim(mv){const{c,i}=mv;
 if(mv.k==='swap'){[[c,i],[mv.tp,mv.tj]].forEach(([q,j])=>fly(MS[q][j],P(q,S.m[q][j],j),.9,0,2,()=>burst(MS[q][j].position,COL[q],18,.25)));return}
 const caps=mv.caps.map(([a,b])=>({a,b,at:MS[a][b].position.clone()})),mk=MS[c][i];
 fly(mk,P(c,S.m[c][i],i),.7*(mv.k==='sc'?1.4:1),0,mv.k==='sc'?5:2.2,()=>{burst(mk.position,COL[c],14,.22);ringFx(mk.position,COL[c]);caps.forEach(x=>{const teammate=x.a%2===c%2,fxColor=teammate?COL[c]:0xff7a2a;burst(x.at,fxColor,teammate?26:45,.45);if(!teammate)burst(x.at,0xff7a2a,30,.5);ringFx(x.at,fxColor)})});
 caps.forEach(x=>fly(MS[x.a][x.b],P(x.a,Y,x.b),.8,.65,3.2,null))}
function newGame(start=true){if(room&&!room.isHost)return;if(start){$('top').querySelector('button').hidden=false;$('startMatch').hidden=true;$('invitePanel').open=false;}networkPending=false;resetGameTimers();clearRings();TW=[];PS.forEach(q=>{scene.remove(q.pt);q.pt.geometry.dispose();q.pt.material.dispose()});PS=[];FX.forEach(q=>{scene.remove(q.m);q.m.geometry.dispose();q.m.material.dispose()});FX.length=0;PILE.forEach(disposeCard);PILE.length=0;if(S&&S.cc)S.cc.remove();S={m:[0,1,2,3].map(()=>[Y,Y,Y,Y]),deck:[],hands:[[],[],[],[]],turn:0,turnAt:Date.now(),phase:'xchg',starter:3,rc:0,started:0,skip:[0,0,0,0],rem:0,exc:-1,bp:null,sel:null,stage:0,opt:null,srcs:[],moves:[],opts:[],log:[],msg:'',busy:0,over:0,dealt:1,cc:null};
 for(let p=0;p<4;p++)for(let i=0;i<4;i++)MS[p][i].position.copy(P(p,Y,i));if(start){drawLeader();startRound()}else{S.phase='play';S.busy=1;S.msg='بانتظار بدء المضيف للمباراة';S.log=[S.msg];draw()}}
function drawLeader(){const d=[],V={A:14,K:13,Q:12,J:11},v=c=>(V[c.r]||+c.r)*10+SU.indexOf(c.s);
 for(let p=0;p<4;p++){let c;do{c={r:RK[rnd()*13|0],s:SU[rnd()*4|0]}}while(d.some(x=>x.r===c.r&&x.s===c.s));d.push(c)}
 let l=0;d.forEach((c,p)=>{if(v(c)>v(d[l]))l=p});S.starter=l;log(`سحب الجميع ورقة (${d.map((c,p)=>playerName(p)+' '+c.r+c.s).join('، ')}) فالأعلى لـ${playerName(l)}: قائد الجولة`)}
/* ---------- الإدخال والعرض ---------- */
const RC=new THREE.Raycaster(),V2=new THREE.Vector2();
function hit(e,o){pointerVector(e.clientX,e.clientY);RC.setFromCamera(V2,cam);return RC.intersectObjects(o,true)[0]}
setupTouch();cv.addEventListener('pointerdown',()=>SFX.wake(),{once:true});

cv.onpointermove=e=>{if(camMode===1)return;cv.style.cursor=S&&S.stage>=3&&((RG.length&&hit(e,RG))||(hit(e,S.srcs)))?'pointer':'default'};
function rs(){updateCamera()}
addEventListener('resize',rs);new ResizeObserver(rs).observe($('board'));rs();
const chosenMode=window.JACKAROO_MODE||'ai';
if(chosenMode==='ai'){setSeatPresentation();newGame();$('shareBtn').hidden=true;$('chatPanel').hidden=true}
else{newGame(false);$('top').querySelector('button').hidden=true;$('shareBtn').disabled=true;connectionStatus(chosenMode==='join'?'جارٍ الاتصال بالغرفة…':'جارٍ إنشاء غرفة…');connectRoom(chosenMode==='join'?roomParam:null).then(()=>{$('shareBtn').disabled=false}).catch(e=>{connectionStatus(e.message);$('msg').textContent='تعذر فتح الغرفة. يمكنك العودة للقائمة والمحاولة مجدداً.'})}
const clk=new THREE.Clock();
(function loop(){requestAnimationFrame(loop);const dt=Math.min(clk.getDelta(),.05),t=clk.elapsedTime;
 for(let k=TW.length-1;k>=0;k--){const w=TW[k];if((w.del-=dt)>0)continue;w.e+=dt;const u=Math.min(1,w.e/w.d),s=u<.5?2*u*u:1-2*(1-u)*(1-u);
  w.o.position.lerpVectors(w.f,w.t,s);w.o.position.y+=Math.sin(Math.PI*u)*w.a;if(w.rt)w.o.rotation.set(w.rf.x+(w.rt.x-w.rf.x)*s,w.rf.y+(w.rt.y-w.rf.y)*s,w.rf.z+(w.rt.z-w.rf.z)*s);if(u>=1){TW.splice(k,1);w.cb&&w.cb()}}
 for(let k=PS.length-1;k>=0;k--){const q=PS[k],a=q.pt.geometry.attributes.position;q.age+=dt;
  q.vel.forEach((v,i)=>{v.y-=9*dt;a.setXYZ(i,a.getX(i)+v.x*dt,a.getY(i)+v.y*dt,a.getZ(i)+v.z*dt)});a.needsUpdate=true;q.pt.material.opacity=Math.max(0,1-q.age/.9);
  if(q.age>.9){scene.remove(q.pt);q.pt.geometry.dispose();q.pt.material.dispose();PS.splice(k,1)}}
 MS.flat().forEach(m=>m.mat.emissiveIntensity=S&&S.stage>=2&&S.srcs.includes(m)?.45+.3*Math.sin(t*7):.15);
 RG.forEach(r=>r.rotation.z=t*2);for(let k=FX.length-1;k>=0;k--){const q=FX[k];q.a+=dt;q.m.scale.setScalar(1+q.a*5);q.m.material.opacity=Math.max(0,1-q.a*1.5);if(q.a>.7){scene.remove(q.m);q.m.geometry.dispose();q.m.material.dispose();FX.splice(k,1)}}neonUpdate(t);ren.render(scene,cam)})();
