const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function lobby(room=''){
 const elements=Object.fromEntries(['startMenu','startStatus','startAI','startFriends','startJoin','playerName'].map(id=>[id,{hidden:false,disabled:false,textContent:'',value:'Majed',focus(){},setCustomValidity(){},reportValidity(){},addEventListener(){}}]));
 const scripts=[];const context={URL,sessionStorage:{getItem:()=> 'Majed',setItem(){}},location:{href:'https://jackaro.homes/game.html'+room},window:{},document:{getElementById:id=>elements[id],body:{classList:{remove(){}}},createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}}};
 vm.runInNewContext(fs.readFileSync('game-lobby.js','utf8'),context);return {elements,scripts,context};
}
test('opening play loads no game or Firebase connection before a mode is selected',()=>{
 const {scripts,elements}=lobby();assert.equal(scripts.length,0);assert.equal(elements.startJoin.hidden,true);assert.equal(elements.startFriends.hidden,false);
});
test('an invitation offers joining without starting or creating an unrelated room',()=>{
 const {scripts,elements}=lobby('?room='+'ab'.repeat(12));assert.equal(scripts.length,0);assert.equal(elements.startJoin.hidden,false);assert.equal(elements.startFriends.hidden,true);
});
test('selecting a mode loads the game once and prevents duplicate starts',async()=>{
 const {scripts,elements,context}=lobby();const first=elements.startAI.onclick();elements.startAI.onclick();assert.equal(scripts.length,1);assert.equal(context.window.JACKAROO_MODE,'ai');scripts[0].onload();await Promise.resolve();assert.equal(scripts.length,2);scripts[1].onload();await first;assert.equal(elements.startMenu.hidden,true);
});
test('an unstarted friends room has no cards, no running turns and a serializable snapshot',()=>{
 const js=fs.readFileSync('game.js','utf8');const init=js.slice(js.indexOf('function newGame('),js.indexOf('function drawLeader('));
 const c=vm.createContext({});vm.runInContext(`let S,room=null,networkPending=false,TW=[],PS=[],FX=[],PILE=[];const Y=-100;const disposeCard=()=>{},resetGameTimers=()=>{},clearRings=()=>{},draw=()=>{},P=()=>{},MS=Array.from({length:4},()=>Array.from({length:4},()=>({position:{copy(){}}})));`+init+'\nnewGame(false);',c);
 assert.equal(vm.runInContext('S.started',c),0);assert.equal(vm.runInContext('S.busy',c),1);assert.equal(vm.runInContext('S.hands.flat().length',c),0);assert.equal(vm.runInContext('S.rc',c),0);
});
