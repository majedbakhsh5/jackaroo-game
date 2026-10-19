const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=__dirname.replace(/\\tests$/,'');
const read=name=>fs.readFileSync(root+'/'+name,'utf8');

test('site shell exposes the premium RTL navigation and focused landing actions',()=>{
  const html=read('index.html'),css=read('site.css');
  assert.match(html,/class="site-shell"/);assert.match(html,/data-nav-toggle/);assert.match(html,/class="btn btn-primary"[^>]*href="play\.html"/);
  assert.match(html,/id="landingFeatures"/);assert.match(css,/--obsidian/);assert.match(css,/\.site-nav\.open/);assert.match(css,/prefers-reduced-motion/);
});

test('lobby keeps name validation, room modes and accessible loading/error states',()=>{
  const html=read('game.html'),lobby=read('game-lobby.js'),css=read('game.css');
  assert.match(html,/id="startMenu"[^>]*class="lobby-shell"/);assert.match(html,/id="lobbyModeNote"/);assert.match(html,/aria-busy/);
  assert.match(lobby,/setAttribute\('aria-busy','true'\)/);assert.match(lobby,/role.*alert/);assert.match(css,/\.lobby-shell/);
});

test('end-of-match presentation keeps the existing result message and actions',()=>{
  const html=read('game.html'),game=read('game.js'),css=read('game.css');
  assert.match(html,/id="matchResult"/);assert.match(html,/id="matchResultTitle"/);assert.match(game,/matchResult/);assert.match(css,/\.match-result/);
});
