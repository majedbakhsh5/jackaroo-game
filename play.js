(function(){
 const incoming=new URL(location.href).searchParams.get('room');
 if(incoming&&/^[a-f0-9]{24}$/.test(incoming))document.getElementById('game').src='game.html?room='+encodeURIComponent(incoming);
 else if(incoming){const warning=document.createElement('p');warning.textContent='رابط الغرفة غير صالح؛ تم فتح اللعب الفردي.';warning.setAttribute('role','status');document.getElementById('shell').prepend(warning)}
})();
