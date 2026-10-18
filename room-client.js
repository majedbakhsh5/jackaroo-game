/* Host-authoritative friendly rooms. Public snapshots never include opponents' hands. */
(function (root) {
  'use strict';
  const SCHEMA = 2;
  function publicState(state) {
    const {hands,deck,...view}=state;
    return {...view,handCounts:hands.map(h=>h.length)};
  }
  function createView(state, seat, revision) {
    return {state:publicState(state),hand:seat<0?[]:(state.hands[seat]||[]),revision};
  }
  function validMotion(motion){
    if(motion==null)return true;
    const cell=n=>Number.isInteger(n)&&(n===-100||n>=0&&n<=151||n>=1000&&n<=1003);
    if(!motion||typeof motion.id!=='string'||motion.id.length<1||motion.id.length>80||!Number.isFinite(motion.at)||!['fwd','back','out','swap','sc'].includes(motion.k))return false;
    if(!Number.isInteger(motion.c)||motion.c<0||motion.c>3||!Number.isInteger(motion.i)||motion.i<0||motion.i>3||!cell(motion.from))return false;
    if(!Array.isArray(motion.path)||motion.path.length>13||!motion.path.every(cell))return false;
    if(!Array.isArray(motion.captures)||motion.captures.length>13||!motion.captures.every(x=>x&&Number.isInteger(x.c)&&x.c>=0&&x.c<4&&Number.isInteger(x.i)&&x.i>=0&&x.i<4&&cell(x.from)))return false;
    return motion.k==='swap'?Number.isInteger(motion.tp)&&motion.tp>=0&&motion.tp<4&&Number.isInteger(motion.tj)&&motion.tj>=0&&motion.tj<4&&cell(motion.targetFrom)&&cell(motion.to)&&cell(motion.targetTo):cell(motion.to);
  }
  function validView(view) {
    if(!view||!Number.isInteger(view.revision)||view.revision<1||!view.state)return false;
    const s=view.state;
    if(!Number.isInteger(s.turn)||s.turn<0||s.turn>3||!['play','burn','over'].includes(s.phase))return false;
    if(!Array.isArray(s.m)||s.m.length!==4||!s.m.every(row=>Array.isArray(row)&&row.length===4&&row.every(n=>Number.isInteger(n)&&(n===-100||n>=0&&n<=151||n>=1000&&n<=1003))))return false;
    if(!Array.isArray(s.log)||s.log.length>7||!s.log.every(t=>typeof t==='string'&&t.length<=600))return false;
    if(typeof s.msg!=='string'||s.msg.length>600)return false;
    if(!validMotion(s.motion))return false;
    const hand=view.hand||[];
    return Array.isArray(hand)&&hand.length<=5&&hand.every(c=>c&&['A','2','3','4','5','6','7','8','9','10','J','Q','K'].includes(c.r)&&['♠','♥','♦','♣'].includes(c.s));
  }
  function validRoom(id) { return typeof id==='string' && /^[a-f0-9]{24}$/.test(id); }
  function loadScript(src) {
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('تعذر تحميل خدمة الغرف؛ اللعب الفردي متاح'));document.head.appendChild(s)});
  }
  let sdkPromise;
  async function sdk() {
    if (!sdkPromise) sdkPromise=(async()=>{
      const base='https://www.gstatic.com/firebasejs/10.7.0/';
      for (const file of ['firebase-app-compat.js','firebase-auth-compat.js','firebase-database-compat.js']) await loadScript(base+file);
    })().catch(e=>{sdkPromise=null;throw e});
    return sdkPromise;
  }
  async function connect(requestedID, handlers) {
    const config=root.ROOM_CONFIG||{};
    if(!config.enabled) throw new Error('غرف الأصدقاء غير متاحة حالياً؛ يمكنك اللعب ضد الكمبيوتر.');
    if(requestedID&&!validRoom(requestedID)) throw new Error('رابط الغرفة غير صالح');
    await sdk();
    const fb=root.firebase;
    if(!fb.apps.length) fb.initializeApp(config.firebase);
    await fb.auth().setPersistence(fb.auth.Auth.Persistence.SESSION);
    const user=fb.auth().currentUser||(await fb.auth().signInAnonymously()).user;
    const uid=user.uid,db=fb.database();
    const bytes=new Uint8Array(12);root.crypto.getRandomValues(bytes);
    const id=requestedID||Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const ref=db.ref('v2rooms/'+id);
    let meta=(await ref.child('meta').once('value')).val();
    if(!requestedID){meta={host:uid,schema:SCHEMA,created:fb.database.ServerValue.TIMESTAMP,expires:Date.now()+86400000};await ref.child('meta').set(meta);await ref.child('seats/0').set(uid)}
    if(!meta||meta.schema!==SCHEMA||meta.expires<Date.now()) throw new Error('الغرفة غير موجودة أو انتهت صلاحيتها');
    let hostUID=meta.host,isHost=hostUID===uid;
    let seats=(await ref.child('seats').once('value')).val()||{};
    const initialPresence=(await ref.child('presence').once('value')).val()||{};
    let seat=Object.keys(seats).find(k=>seats[k]===uid);
    if(seat===undefined&&!isHost){
      for(let p=1;p<4;p++){
        const result=await ref.child('seats/'+p).transaction(current=>current===null||!initialPresence[current]?.online?uid:undefined);
        if(result.committed){seat=String(p);break}
      }
    }
    seat=seat===undefined?-1:Number(seat);
    let players={},seatClaimedAt={},latest=null,lastSignature='',revision=0,publishing=false,pendingState=null,stopped=false,connected=false,connectedOnce=false,presenceReady=false,seatHistory={},chatReady=false;
    for(const owner of Object.values(seats))if(owner)seatClaimedAt[owner]=Date.now();
    for(const [p,owner]of Object.entries(seats))if(owner)seatHistory[owner]=Number(p);
    const watchers=[];
    const ownPresence=ref.child('presence/'+uid);
    const serverTime=fb.database.ServerValue.TIMESTAMP;
    const onError=()=>handlers.onStatus('تعذر الاتصال بالغرفة؛ تحقق من إعدادات Firebase أو الشبكة');
    function watch(path,event,fn,query){const node=query||ref.child(path);node.on(event,fn,onError);const off=()=>node.off(event,fn);watchers.push(off);return off}
    const hostCommandOffs=[],seenChat=new Set(),pendingChat=new Set();let selfViewOff=null;
    function installCommands(){if(hostCommandOffs.length||!isHost)return;const accept=async snap=>{const command=snap.val(),sender=snap.key;if(!command||!isHost)return;await ref.child('commands/'+sender).remove().catch(onError);const p=Object.keys(seats).find(k=>seats[k]===sender);if(p===undefined||!players[sender]?.online||command.revision!==revision)return;handlers.onCommand(command,Number(p))};hostCommandOffs.push(watch('commands','child_added',snap=>accept(snap).catch(onError)),watch('commands','child_changed',snap=>accept(snap).catch(onError)))}
    function installSelfView(){if(selfViewOff||isHost)return;selfViewOff=watch(seat<0?'public':'views/'+uid,'value',snap=>{if(snap.exists())handlers.onView(snap.val())})}
    function removeSelfView(){if(selfViewOff){selfViewOff();selfViewOff=null}}
    const saved=isHost?(await ref.child('hostState').once('value')).val():null;
    let restored=typeof saved==='string'?JSON.parse(saved):null;
    revision=Number((await ref.child('revision').once('value')).val())||0;
    const api={id,uid,seat,get isHost(){return isHost},get restored(){return restored},
      nameForSeat:p=>{const owner=seats[p];return owner&&players[owner]?.name?players[owner].name:`الكمبيوتر · ${['الأزرق','الأحمر','الأخضر','الذهبي'][p]}`},
      isHuman:p=>{const owner=seats[p];return !!owner&&(!!players[owner]?.online||Date.now()-(seatClaimedAt[owner]||0)<7000)},
      async publish(state){
        if(!isHost||stopped)return;
        pendingState=JSON.parse(JSON.stringify(state));
        if(publishing)return;
        publishing=true;
        try{
          while(pendingState){
            const current=pendingState;pendingState=null;const signature=JSON.stringify([current,seats]);
            if(signature===lastSignature)continue;
            const nextRevision=revision+1,updates={hostState:JSON.stringify(current),public:createView(current,-1,nextRevision),revision:nextRevision};
            for(const [p,owner]of Object.entries(seats))updates['views/'+owner]=createView(current,Number(p),nextRevision);
            await ref.update(updates);revision=nextRevision;lastSignature=signature;latest=current;
          }
        }finally{publishing=false}
      },
      async command(command,expectedRevision){
        if(seat<0||!connected)throw new Error('غير متصل');
        await ref.child('commands/'+uid).set({...command,revision:expectedRevision,nonce:root.crypto.randomUUID(),at:serverTime});
      },
      async sendEmoji(emoji){
        if(!['👍','😂','🔥','😢','🎉'].includes(emoji)||!connected)return;
        await ref.child('emojis/'+uid).set({emoji,at:serverTime});
      },
      async sendChat(text){
        const value=String(text||'').trim().slice(0,240);
        if(!value||!connected) return;
        const message=ref.child('chat/'+uid).push(),messageID=uid+'/'+message.key;
        pendingChat.add(messageID);
        await message.set({text:value,at:serverTime});const confirmed={id:messageID,text:value,at:Date.now(),live:true,uid,name:String(handlers.name||'').trim().slice(0,18),seat};seenChat.add(messageID);handlers.onChat?.(confirmed);return confirmed
      },
      async start(){
        const tryTakeover=()=>{if(players[hostUID]?.online)return;const mine=Object.keys(seats).find(k=>seats[k]===uid);if(mine&&Number(mine)>0&&connected)ref.child('meta/host').transaction(current=>current===hostUID&&!players[current]?.online?uid:undefined).catch(onError)};
        const info=db.ref('.info/connected');
        const onConnect=async snap=>{
          connected=snap.val()===true;
          if(!connected){handlers.onStatus('انقطع الاتصال؛ لا تغلق الصفحة أثناء إعادة الاتصال');return}
          if(connectedOnce)handlers.onReconnect?.();else connectedOnce=true;
          try{await ownPresence.onDisconnect().remove();try{await ownPresence.set({online:true,at:serverTime,name:String(handlers.name||'').trim().slice(0,18)})}catch(_){await ownPresence.set({online:true,at:serverTime})}handlers.onStatus(isHost?'أنت مضيف الغرفة':seat<0?'وضع المشاهدة':'متصل بالغرفة');tryTakeover()}catch(e){onError()}
        };
        info.on('value',onConnect);watchers.push(()=>info.off('value',onConnect));
        watch('seats','value',snap=>{const next=snap.val()||{};for(const [p,owner]of Object.entries(next))if(owner){if(!seatClaimedAt[owner])seatClaimedAt[owner]=Date.now();seatHistory[owner]=Number(p)}seats=next;if(isHost&&latest)api.publish(latest).catch(onError);handlers.onPlayers()});
        watch('presence','value',snap=>{const next=snap.val()||{};if(presenceReady){for(const [owner,info]of Object.entries(next))if(info?.online&&!players[owner]?.online){const p=Object.keys(seats).find(k=>seats[k]===owner);if(p!==undefined)handlers.onPlayerEvent?.({type:'join',uid:owner,seat:Number(p),name:info.name})}for(const [owner,info]of Object.entries(players))if(info?.online&&!next[owner]?.online){const p=Object.keys(seats).find(k=>seats[k]===owner);handlers.onPlayerEvent?.({type:'leave',uid:owner,seat:p===undefined?seatHistory[owner]:Number(p),name:info.name})}}else presenceReady=true;players=next;if(!players[hostUID]?.online){handlers.onStatus('غادر المضيف؛ جارٍ نقل إدارة اللعبة');tryTakeover()}else handlers.onPlayers()});
        watch('meta/host','value',snap=>{const next=snap.val();if(!next||next===hostUID)return;const oldHost=hostUID;hostUID=next;meta.host=next;isHost=next===uid;if(isHost){removeSelfView();(async()=>{try{const value=(await ref.child('hostState').once('value')).val();restored=typeof value==='string'?JSON.parse(value):null;revision=Number((await ref.child('revision').once('value')).val())||revision;installCommands();handlers.onHostChange?.(restored);handlers.onStatus('توليت إدارة المباراة بعد مغادرة المضيف')}catch(_){onError()}})()}else{hostCommandOffs.splice(0).forEach(off=>off());installSelfView()}handlers.onPlayers()});
        if(!isHost)installSelfView();
        if(isHost)installCommands();
        const started=Date.now()-1000,emojiTimes=new Map();
        const receive=snap=>{const e=snap.val();if(!e||snap.key===uid||e.at<started||e.at<=(emojiTimes.get(snap.key)||0))return;emojiTimes.set(snap.key,e.at);if(['👍','😂','🔥','😢','🎉'].includes(e.emoji))handlers.onEmoji(e.emoji)};
        watch('emojis','child_added',receive);watch('emojis','child_changed',receive);
        watch('chat','value',snap=>{const owners=snap.val()||{};for(const [ownerUID,messages]of Object.entries(owners))for(const [messageID,item]of Object.entries(messages||{})){const key=ownerUID+'/'+messageID,at=Number(item?.at),storedSeat=Number(item?.seat),currentSeat=Number(Object.keys(seats).find(p=>seats[p]===ownerUID));if(!item||seenChat.has(key)||pendingChat.has(key)||ownerUID===uid&&chatReady||typeof item.text!=='string'||item.text.length>240||!Number.isFinite(at))continue;seenChat.add(key);handlers.onChat?.({id:key,text:item.text,at,live:chatReady,uid:ownerUID,name:typeof item.name==='string'?item.name.slice(0,18):players[ownerUID]?.name||'',seat:Number.isInteger(storedSeat)&&storedSeat>=0&&storedSeat<4?storedSeat:currentSeat})}chatReady=true});
      },
      async close(){stopped=true;watchers.forEach(fn=>fn());await ownPresence.remove();if(seat>0)await ref.child('seats/'+seat).remove()}
    };
    return api;
  }
  const api={connect,publicState,createView,validRoom,validView};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JackarooRooms=api;
})(typeof window!=='undefined'?window:globalThis);
