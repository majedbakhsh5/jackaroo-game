/* Lightweight, text-only multiplayer chat presentation. */
(function(root){
  'use strict';
  function create(options){
    const doc=options.document||root.document,{panel,toggle,body,list,mini,miniName,miniText,badge,floatLayer}=options;
    const getName=options.getName||(()=>''),getColor=options.getColor||(()=>''),setTimer=options.setTimer||root.setTimeout.bind(root),seen=new Set();
    let open=false,latestAt=-Infinity;
    function setOpen(value){
      open=!!value;body.hidden=!open;panel.dataset.open=String(open);toggle.setAttribute('aria-expanded',String(open));
      if(open){badge.hidden=true;badge.textContent='0'}
    }
    function onToggle(){setOpen(!open)}
    function onOutside(event){if(open&&!panel.contains(event.target))setOpen(false)}
    function onKey(event){if(event.key==='Escape'&&open)setOpen(false)}
    toggle.addEventListener('click',onToggle);doc.addEventListener('pointerdown',onOutside);doc.addEventListener('keydown',onKey);setOpen(false);
    function textNode(tag,className,text){const node=doc.createElement(tag);node.className=className;node.textContent=text;return node}
    function add(message){
      const text=String(message?.text??'').trim().slice(0,240);if(!text)return false;
      const id=String(message.id||`${message.uid||''}:${message.at||''}:${text}`);if(seen.has(id))return false;seen.add(id);
      const seat=Number.isInteger(message.seat)&&message.seat>=0&&message.seat<4?message.seat:0;
      const name=String(message.name||getName(seat)||'لاعب').trim().slice(0,40)||'لاعب',color=getColor(seat),at=Number.isFinite(Number(message.at))?Number(message.at):Date.now();
      const row=doc.createElement('div'),rowName=textNode('b','chat-line-name',name),rowText=textNode('span','chat-line-text',text);
      row.className='chat-line'+(message.own?' own':'');row.setAttribute('dir','auto');rowName.style.color=color;row.append(rowName,rowText);list.append(row);
      while(list.children.length>40)list.firstElementChild.remove();list.scrollTop=list.scrollHeight;
      if(at>=latestAt){latestAt=at;mini.hidden=false;miniName.textContent=name;miniName.style.color=color;miniText.textContent=text;mini.setAttribute('dir','auto')}
      if(message.live!==false){
        const floating=doc.createElement('div'),floatingName=textNode('b','chat-float-name',name),floatingText=textNode('span','chat-float-text',text);
        floating.className='chat-float';floating.setAttribute('dir','auto');floatingName.style.color=color;floating.append(floatingName,floatingText);floatLayer.append(floating);setTimer(()=>floating.remove(),4000);
        if(!message.own){options.onNotify?.();if(!open){badge.hidden=false;badge.textContent=String((Number(badge.textContent)||0)+1)}}
      }
      return true;
    }
    return{add,setOpen,get open(){return open},destroy(){toggle.removeEventListener('click',onToggle);doc.removeEventListener('pointerdown',onOutside);doc.removeEventListener('keydown',onKey)}};
  }
  const api={create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JackarooChat=api;
})(typeof window!=='undefined'?window:globalThis);
