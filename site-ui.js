(function(){
  'use strict';
  const toggle=document.querySelector('[data-nav-toggle]'),nav=document.getElementById('siteNav');
  if(!toggle||!nav)return;
  toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});
  nav.addEventListener('click',event=>{if(event.target.closest('a')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}});
})();
