const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Reactions=require('../game-reactions.js');

test('premium catalog exposes six Arabic-friendly multiplayer reactions',()=>{
  assert.deepEqual(Reactions.items.map(item=>item.emoji),['😂','👏','🤩','😮','👋','🎉']);
  assert.ok(Reactions.items.every(item=>item.key&&item.label&&item.hint));
  assert.equal(Reactions.normalize('👏').key,'applause');
  assert.equal(Reactions.normalize({emoji:'🎉'}).key,'celebration');
  assert.equal(Reactions.normalize('👍'),null);
});

test('reaction positions follow the sender seat from each viewer perspective',()=>{
  assert.equal(Reactions.seatPosition(0,0),'br');
  assert.equal(Reactions.seatPosition(1,0),'bl');
  assert.equal(Reactions.seatPosition(2,0),'tl');
  assert.equal(Reactions.seatPosition(3,0),'tr');
  assert.equal(Reactions.seatPosition(0,2),'tl');
  assert.equal(Reactions.seatPosition(9,0),'center');
});

test('game integration keeps reactions multiplayer-safe, anchored and mute-aware',()=>{
  const game=fs.readFileSync('game.js','utf8'),room=fs.readFileSync('room-client.js','utf8'),html=fs.readFileSync('game.html','utf8'),css=fs.readFileSync('game.css','utf8'),sound=fs.readFileSync('game-sound.js','utf8'),rules=fs.readFileSync('database.rules.json','utf8');
  assert.match(game,/reactionLayer/);assert.match(game,/room\.sendEmoji/);assert.match(game,/SFX\.play\('reaction'\)/);
  assert.match(room,/seat:.*senderSeat/);assert.match(room,/\['😂','👏','🤩','😮','👋','🎉'\]/);
  assert.match(html,/data-reaction="👏"/);assert.match(html,/game-reactions\.js/);
  assert.match(css,/reactionFloat/);assert.match(css,/max-width:600px/);
  assert.match(sound,/reaction:\[/);assert.match(sound,/if\(!enabled\)return/);
  assert.match(rules,/newData\.child\('emoji'\)\.val\(\) === '👏'/);
});
