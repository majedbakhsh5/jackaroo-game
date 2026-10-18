(function(){
 function failed(){const box=document.getElementById('gameError');if(!box)return;box.hidden=false;document.querySelectorAll('#toolbar button, #top button').forEach(button=>{button.disabled=true});box.replaceChildren();const title=document.createElement('h1');title.textContent='تعذر تشغيل الرسوم ثلاثية الأبعاد';const note=document.createElement('p');note.textContent='تحقق من تفعيل تسريع الرسوم في المتصفح، ثم أعد تحميل الصفحة. يمكنك تجربة متصفح حديث آخر.';const retry=document.createElement('button');retry.textContent='إعادة المحاولة';retry.onclick=()=>location.reload();box.append(title,note,retry)}
 window.addEventListener('error',e=>{if(e.filename&&/game\.js|three\.min\.js/.test(e.filename))failed()});
 document.getElementById('cv').addEventListener('webglcontextlost',e=>{e.preventDefault();failed()});
})();
