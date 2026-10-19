const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Cards=require('../game-cards.js');

test('all 52 card identities retain their exact rank and suit',()=>{
 const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],suits=['♠','♥','♦','♣'],keys=new Set();
 for(const rank of ranks)for(const suit of suits){const identity=Cards.identity({r:rank,s:suit});assert.deepEqual(identity,{rank,suit,key:rank+suit,red:suit==='♥'||suit==='♦'});keys.add(identity.key)}
 assert.equal(keys.size,52);assert.equal(Cards.identity({r:'14',s:'♠'}),null);assert.equal(Cards.identity({r:'A',s:'?'}),null);
});

test('hand presentation preserves identity and the selected card',()=>{
 const hand=[{r:'A',s:'♠'},{r:'10',s:'♥'},{r:'J',s:'♦'}],model=Cards.hand(hand,{selected:1});
 assert.deepEqual(model.map(card=>card.key),['A♠','10♥','J♦']);
 assert.deepEqual(model.map(card=>card.selected),[false,true,false]);
 assert.equal(model[1].red,true);assert.equal(model[1].ariaLabel,'10 ♥');
});

test('spectators and non-owners receive no card presentation data',()=>{
 const cards=[{r:'K',s:'♣'}];
 assert.deepEqual(Cards.hand(cards,{visible:false}),[]);
 assert.deepEqual(Cards.hand(cards,{visible:true})[0].key,'K♣');
});

test('five-card fan is symmetric, ordered and remains compact',()=>{
 const hand=Cards.hand(['A','2','3','4','5'].map(r=>({r,s:'♠'})));
 assert.deepEqual(hand.map(card=>card.position.z),[1,2,3,4,5]);
 assert.equal(hand[0].position.angle,-hand[4].position.angle);assert.equal(hand[1].position.angle,-hand[3].position.angle);
 assert.equal(hand[2].position.angle,0);assert.equal(hand[0].position.lift,hand[4].position.lift);
 assert.ok(Math.abs(hand[0].position.angle)<=12);assert.ok(hand.every(card=>card.position.lift<=8));
});

test('animation cancellation invalidates stale deal, flip and play completions',()=>{
 const animations=Cards.createAnimationState(),deal=animations.begin('deal');assert.equal(animations.isCurrent(deal),true);
 const flip=animations.begin('flip');assert.equal(animations.isCurrent(deal),false);assert.equal(animations.isCurrent(flip),true);
 animations.cancel();assert.equal(animations.isCurrent(flip),false);assert.equal(animations.active,null);
 const play=animations.begin('play');assert.equal(animations.finish(play),true);assert.equal(animations.active,null);assert.equal(animations.finish(play),false);
});

test('the game routes deal, flip and play through cancellable presentation tokens',()=>{
 const game=fs.readFileSync('game.js','utf8');
 for(const kind of ['deal','flip','play'])assert.match(game,new RegExp(`cardAnimations\\.begin\\('${kind}'\\)`));
 assert.match(game,/cardAnimations\.finish\(/);
});

test('card UI supports touch, reduced motion, premium states and responsive layouts',()=>{
 const css=fs.readFileSync('game.css','utf8');
 assert.match(css,/\.cd\{[^}]*touch-action:manipulation/);assert.match(css,/\.cd\.on/);assert.match(css,/\.cd\.dl/);
 assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media\(max-width:520px\)/);assert.match(css,/@media\(max-height:520px\) and \(min-width:600px\)/);
});

test('card sounds use the existing unlocked and mute-aware synthesizer',()=>{
 const sound=fs.readFileSync('game-sound.js','utf8'),game=fs.readFileSync('game.js','utf8');
 for(const cue of ['cardSelect','cardFlip','cardPlay'])assert.match(sound,new RegExp(`${cue}:\\[`));
 assert.match(game,/SFX\.play\('cardSelect'\)/);assert.match(game,/SFX\.play\('cardFlip'\)/);assert.match(game,/SFX\.play\('cardPlay'\)/);
 assert.match(sound,/if\(!enabled\)return/);assert.match(sound,/if\(!unlocked\)\{wake\(\);return/);
});

test('reconnect presentation cancels stale card animation and never replays dealing',()=>{
 const html=fs.readFileSync('game.html','utf8'),game=fs.readFileSync('game.js','utf8'),receive=game.slice(game.indexOf('function receiveGame('),game.indexOf('function authorizeTimedAction('));
 assert.ok(html.indexOf('game-cards.js')>=0&&html.indexOf('game-cards.js')<html.indexOf('game-lobby.js'));
 assert.match(game,/CARDS\.hand\(/);
 assert.match(receive,/resetGameTimers\(\)/);assert.match(receive,/dealt:0/);assert.match(game,/function resetGameTimers\(\)[^{]*\{[^}]*cardAnimations\.cancel\(\)/);
});

test('Phase 4 timer integration and Firebase rules stay outside the card redesign',()=>{
 const game=fs.readFileSync('game.js','utf8'),timer=fs.readFileSync('game-turn-timer.js','utf8');
 assert.match(game,/authorizeTimedAction/);assert.match(game,/autoSelectedCard/);assert.match(timer,/TURN_MS=10000/);assert.match(timer,/GRACE_MS=5000/);
});
