(function(){
 'use strict';
 const config=window.ADS_CONFIG||{};
 const validSlot=id=>/^\d{6,20}$/.test(String(id||''));
 const configured=/^ca-pub-\d{16}$/.test(config.client||'')&&config.privacyReady===true;
 if(!configured)return;
 let script,failed=false;
 window.googlefc=window.googlefc||{};window.googlefc.callbackQueue=window.googlefc.callbackQueue||[];
 window.googlefc.callbackQueue.push({CONSENT_API_READY:()=>{
  if(typeof window.googlefc.showRevocationMessage!=='function')return;
  document.querySelectorAll('[data-consent-settings]').forEach(button=>{button.hidden=false;button.onclick=()=>window.googlefc.callbackQueue.push({CONSENT_API_READY:()=>window.googlefc.showRevocationMessage()})});
 }});
 function boot(){
  if(script)return;
  script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';
  script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+config.client;
  script.onerror=()=>{failed=true;document.body.classList.remove('wide','mob');document.querySelectorAll('.adbox,.ad-slot').forEach(box=>{box.hidden=true})};
  document.head.appendChild(script);
 }
 function unit(box,id,width,height){
  if(!box||!validSlot(id)||box.dataset.done)return;
  box.dataset.done='true';box.setAttribute('aria-label','إعلانات');
  const label=document.createElement('span');label.className='ad-label';label.textContent='إعلانات';
  const ins=document.createElement('ins');ins.className='adsbygoogle';
  if(width){ins.style.cssText=`display:inline-block;width:${width}px;height:${height}px`}
  else{ins.style.display='block';ins.dataset.adFormat='auto';ins.dataset.fullWidthResponsive='true'}
  ins.dataset.adClient=config.client;ins.dataset.adSlot=String(id);box.append(label,ins);boot();
  (window.adsbygoogle=window.adsbygoogle||[]).push({});
  const observer=new MutationObserver(()=>{
   if(ins.dataset.adStatus==='unfilled'){box.dataset.unfilled='true';box.hidden=true;applyLayout();observer.disconnect()}
  });observer.observe(ins,{attributes:true,attributeFilter:['data-ad-status']});
 }
 const rail=document.getElementById('rail'),banner=document.getElementById('bn');
 function applyLayout(){
  if(!rail||failed)return;
  const wide=matchMedia('(min-width:1200px) and (min-height:700px)').matches&&validSlot(config.slotRail)&&!rail.dataset.unfilled;
  const mobile=!wide&&config.mobileBanner&&matchMedia('(min-width:360px) and (max-width:767px) and (min-height:1050px)').matches&&validSlot(config.slotBanner)&&banner&&!banner.dataset.unfilled;
  document.body.classList.toggle('wide',!!wide);document.body.classList.toggle('mob',!!mobile);
  if(wide)unit(rail,config.slotRail,160,600);
  if(mobile)unit(banner,config.slotBanner,320,50);
 }
 function ready(){
  // The AdSense tag also delivers the published consent message on pages without ad units.
  boot();
  document.querySelectorAll('[data-ad="content"]').forEach(box=>{
   if(validSlot(config.slotContent)&&box.getBoundingClientRect().width>=250)unit(box,config.slotContent);
  });applyLayout();
  window.addEventListener('resize',applyLayout,{passive:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
