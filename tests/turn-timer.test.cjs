const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Timer=require('../game-turn-timer.js');

const turn=(overrides={})=>({turnAt:1000,turn:1,phase:'play',...overrides});

test('the authoritative turn window remains ten seconds',()=>{
 const state=turn(),timer=Timer.begin(state);
 assert.equal(Timer.TURN_MS,10000);
 assert.deepEqual(Timer.remaining(timer,state,1000),{mode:'turn',seconds:10,deadline:11000});
 assert.equal(Timer.remaining(timer,state,10999).seconds,1);
 assert.equal(Timer.remaining(timer,state,11000).seconds,0);
});

test('only the active player sees the floating five-to-one warning',()=>{
 const state=turn(),timer=Timer.begin(state);
 assert.deepEqual([6000,7000,8000,9000,10000].map(now=>Timer.presentation(timer,state,now,{viewerSeat:1,connected:true}).seconds),[5,4,3,2,1]);
 assert.equal(Timer.presentation(timer,state,6000,{viewerSeat:0,connected:true}).visible,false);
 assert.equal(Timer.presentation(timer,state,6000,{viewerSeat:1,connected:false}).visible,false);
 assert.equal(Timer.presentation(timer,state,6000,{viewerSeat:1,connected:true,busy:true}).visible,false);
});

test('an expired turn without a selected legal card keeps normal timeout behavior',()=>{
 const state=turn(),timer=Timer.begin(state),result=Timer.expire(timer,state,11000,false);
 assert.equal(result.kind,'normal-timeout');
 assert.equal(result.timer.resolved,true);
 assert.equal(result.timer.graceUsed,false);
});

test('a valid selected card receives one five-second grace period after the original deadline',()=>{
 const state=turn();let timer=Timer.select(Timer.begin(state),state,{index:2,card:{r:'7',s:'♠'},legal:true},9000);
 const granted=Timer.expire(timer,state,11000,true);timer=granted.timer;
 assert.equal(granted.kind,'grant-grace');
 assert.equal(timer.graceUsed,true);assert.equal(timer.graceUntil,16000);
 assert.deepEqual(Timer.remaining(timer,state,11000),{mode:'grace',seconds:5,deadline:16000});
 assert.equal(Timer.expire(timer,state,12000,true).kind,'waiting');
 assert.equal(Timer.expire(timer,state,16000,true).kind,'selected-timeout');
});

test('completing a move during grace cancels automatic timeout action',()=>{
 const state=turn();let timer=Timer.select(Timer.begin(state),state,{index:0,card:{r:'A',s:'♥'},legal:true},9000);
 timer=Timer.expire(timer,state,11000,true).timer;
 timer=Timer.resolve(timer,state);
 assert.equal(Timer.expire(timer,state,16000,true).kind,'none');
 assert.equal(Timer.presentation(timer,state,12000,{viewerSeat:1,connected:true}).visible,false);
});

test('the selected card is locked during grace and cannot be replaced',()=>{
 const state=turn();let timer=Timer.select(Timer.begin(state),state,{index:1,card:{r:'J',s:'♦'},legal:true},9000);
 timer=Timer.expire(timer,state,11000,true).timer;
 const changed=Timer.select(timer,state,{index:3,card:{r:'K',s:'♣'},legal:true},12000);
 assert.deepEqual(changed.selected,{index:1,card:{r:'J',s:'♦'}});
 assert.equal(Timer.sameSelection(changed,{index:1,card:{r:'J',s:'♦'}}),true);
 assert.equal(Timer.sameSelection(changed,{index:3,card:{r:'K',s:'♣'}}),false);
});
test('a player may clear the selection before the original deadline but not during grace',()=>{
 const state=turn(),selection={index:0,card:{r:'7',s:'♠'},legal:true};let timer=Timer.select(null,state,selection,2000);
 timer=Timer.clear(timer,state,selection,3000);assert.equal(timer.selected,null);
 timer=Timer.select(timer,state,selection,4000);timer=Timer.expire(timer,state,11000,true).timer;
 timer=Timer.clear(timer,state,selection,12000);assert.equal(timer.selected.card.r,'7');
});

test('automatic choice considers only legal actions supplied for the selected card',()=>{
 const selectedMoves=[{k:'fwd',n:2,score:10},{k:'back',n:4,score:30}],otherCardMove={k:'out',score:999};
 const chosen=Timer.bestAction(selectedMoves,move=>move.score);
 assert.equal(chosen,selectedMoves[1]);
 assert.notEqual(chosen,otherCardMove);
});

test('split-seven and Jack-swap representations are selected without fabrication',()=>{
 const split={k:'fwd',c:0,i:0,n:3,to:13,caps:[]},swap={k:'swap',c:0,i:0,tp:1,tj:2,caps:[]};
 assert.equal(Timer.bestAction([split],()=>1),split);
 assert.equal(Timer.bestAction([swap],()=>1),swap);
 assert.deepEqual(swap,{k:'swap',c:0,i:0,tp:1,tj:2,caps:[]});
});

test('a resolved timeout cannot produce a duplicate automatic action',()=>{
 const state=turn();let timer=Timer.select(Timer.begin(state),state,{index:0,card:{r:'Q',s:'♠'},legal:true},5000);
 timer=Timer.expire(timer,state,16000,true).timer;
 assert.equal(timer.resolved,true);
 assert.equal(Timer.expire(timer,state,17000,true).kind,'none');
});

test('turn transition and reset discard stale selection and grace state',()=>{
 const first=turn();let timer=Timer.select(Timer.begin(first),first,{index:0,card:{r:'J',s:'♠'},legal:true},8000);
 timer=Timer.expire(timer,first,11000,true).timer;
 const next=turn({turnAt:20000,turn:0});timer=Timer.ensure(timer,next);
 assert.equal(timer.key,Timer.key(next));assert.equal(timer.selected,null);assert.equal(timer.graceUsed,false);assert.equal(timer.graceUntil,0);
});

test('the floating timer cannot intercept gameplay and supports responsive layouts',()=>{
 const html=fs.readFileSync('game.html','utf8'),css=fs.readFileSync('game.css','utf8');
 assert.match(html,/id="turnWarning"/);
 assert.match(css,/#turnWarning\{[^}]*pointer-events:none/);
 assert.match(css,/#turnWarning\.grace/);
 assert.match(css,/#turnWarning\.grace\.danger/);
 assert.match(css,/@media\(max-width:600px\)[^{]*\{[^}]*#turnWarning/);
 assert.match(css,/@media\(max-height:520px\) and \(min-width:600px\)[^{]*\{[^}]*#turnWarning/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Phase 2 motion and audio plus Phase 3 chat remain loaded',()=>{
 const html=fs.readFileSync('game.html','utf8');
 assert.match(html,/game-sound\.js/);assert.match(html,/game-motion\.js/);assert.match(html,/game-chat\.js/);
});

test('multiplayer rules accept only the minimal card-selection command extension',()=>{
 const rules=fs.readFileSync('database.rules.json','utf8'),game=fs.readFileSync('game.js','utf8');
 assert.match(rules,/child\('type'\)\.val\(\) === 'select'/);
 assert.match(rules,/child\('active'\)\.isBoolean\(\)/);
 assert.match(rules,/\$other === 'active'/);
 assert.match(game,/const receivedAt=Date\.now\(\)/);
 assert.doesNotMatch(game,/authorizeTimedAction\(seat,ci,Number\(command\.at\)/);
 assert.match(game,/outcome\.kind==='selected-timeout'\)\{autoSelectedCard\(p\);return false\}/);
 assert.match(game,/outcome\.kind==='normal-timeout'\)\{cpu\(p,true\);return false\}/);
});
