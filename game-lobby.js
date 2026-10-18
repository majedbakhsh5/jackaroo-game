/* Do not initialize the renderer, deal cards or connect a room until a choice. */
(function(){
 const $=id=>document.getElementById(id),id=new URL(location.href).searchParams.get('room');
 const invitation=/^[a-f0-9]{24}$/.test(id||'');let loading=false;const nameField=$('playerName');try{nameField.value=sessionStorage.getItem('jackaroo-player-name')||''}catch(_){}nameField.addEventListener('input',()=>nameField.setCustomValidity(''));
 $('startJoin').hidden=!invitation;$('startFriends').hidden=invitation;
 function load(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('تعذر تحميل اللعبة. تحقق من الاتصال ثم أعد المحاولة.'));document.head.appendChild(script)})}
 async function choose(mode){
  if(loading)return;const playerName=nameField.value.trim().replace(/\s+/g,' ');if(!playerName){nameField.setCustomValidity('اكتب اسمك قبل الدخول');nameField.reportValidity();nameField.focus();return}nameField.setCustomValidity('');try{sessionStorage.setItem('jackaroo-player-name',playerName)}catch(_){}window.JACKAROO_PLAYER_NAME=playerName;loading=true;window.JACKAROO_MODE=mode;
  for(const name of ['startAI','startFriends','startJoin'])$(name).disabled=true;
  $('startStatus').textContent='جارٍ تجهيز اللوح…';
  try{await load('three.min.js?v=20261018-rooms1');await load('game.js?v=20261018-turns1');$('startMenu').hidden=true;document.body.classList.remove('choosing')}
  catch(e){$('startStatus').textContent=e.message;const retry=document.createElement('button');retry.textContent='إعادة المحاولة';retry.onclick=()=>location.reload();$('startStatus').appendChild(retry)}
 }
 $('startAI').onclick=()=>choose('ai');$('startFriends').onclick=()=>choose('friends');$('startJoin').onclick=()=>choose('join');
})();
