const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Chat=require('../game-chat.js');

class Target{
 constructor(){this.listeners={}}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
 removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==fn)}
 dispatch(type,event={}){for(const fn of this.listeners[type]||[])fn({target:this,key:'',...event})}
}
class Element extends Target{
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.hidden=false;this.textContent='';this.className='';this.style={};this.dataset={};this.attributes={};this.scrollTop=0;this.scrollHeight=0}
 append(...items){for(const item of items){item.parentNode=this;this.children.push(item)}this.scrollHeight=this.children.length}
 appendChild(item){this.append(item);return item}
 replaceChildren(...items){this.children=[];this.append(...items)}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(item=>item!==this);this.parentNode=null}
 contains(item){return item===this||this.children.some(child=>child.contains(item))}
 setAttribute(name,value){this.attributes[name]=String(value)}
 getAttribute(name){return this.attributes[name]}
 get firstElementChild(){return this.children[0]||null}
}
class Document extends Target{createElement(tag){return new Element(tag)}}

function fixture(){
 const document=new Document(),panel=new Element(),toggle=new Element('button'),body=new Element('section'),list=new Element(),mini=new Element(),miniName=new Element('b'),miniText=new Element('span'),badge=new Element(),floatLayer=new Element(),input=new Element('input'),timers=[],notifications=[];
 panel.append(toggle,body);body.hidden=true;mini.hidden=true;badge.hidden=true;
 const chat=Chat.create({document,panel,toggle,body,list,mini,miniName,miniText,badge,floatLayer,input,getName:seat=>['أزرق','Red','Green','Gold'][seat],getColor:seat=>['#247bff','#d92745','#00b879','#f5b83d'][seat],setTimer:(fn,ms)=>{timers.push({fn,ms});return timers.length},onNotify:()=>notifications.push(true)});
 return{document,panel,toggle,body,list,mini,miniName,miniText,badge,floatLayer,input,timers,notifications,chat};
}

test('chat toggles, closes outside and on Escape, and stays open for inside clicks',()=>{
 const f=fixture();
 f.toggle.dispatch('click');assert.equal(f.chat.open,true);assert.equal(f.body.hidden,false);assert.equal(f.toggle.getAttribute('aria-expanded'),'true');
 f.document.dispatch('pointerdown',{target:f.body});assert.equal(f.chat.open,true);
 f.document.dispatch('pointerdown',{target:new Element()});assert.equal(f.chat.open,false);assert.equal(f.body.hidden,true);
 f.toggle.dispatch('click');f.document.dispatch('keydown',{key:'Escape',target:f.input});assert.equal(f.chat.open,false);
});

test('latest message persists with the assigned player color',()=>{
 const f=fixture();
 f.chat.add({id:'newer',at:20,seat:1,text:'Hello',live:false});
 f.chat.add({id:'older',at:10,seat:0,text:'قديم',live:false});
 assert.equal(f.mini.hidden,false);assert.equal(f.miniName.textContent,'Red');assert.equal(f.miniName.style.color,'#d92745');assert.equal(f.miniText.textContent,'Hello');
 f.toggle.dispatch('click',{target:f.mini});assert.equal(f.chat.open,true);f.toggle.dispatch('click',{target:f.mini});assert.equal(f.chat.open,false);assert.equal(f.miniText.textContent,'Hello');
});

test('floating Arabic and English text is safe, colored and expires after four seconds',()=>{
 const f=fixture();
 assert.equal(f.chat.add({id:'mixed',at:30,seat:0,text:'مرحبا Jackaroo <script>',live:true}),true);
 const floating=f.floatLayer.children[0];assert.equal(floating.children[0].textContent,'أزرق');assert.equal(floating.children[0].style.color,'#247bff');assert.equal(floating.children[1].textContent,'مرحبا Jackaroo <script>');
 assert.equal(f.timers[0].ms,4000);f.timers[0].fn();assert.equal(f.floatLayer.children.length,0);
});

test('duplicate messages are ignored and replayed history does not float',()=>{
 const f=fixture(),message={id:'same-message',at:40,seat:2,text:'One',live:true};
 assert.equal(f.chat.add(message),true);assert.equal(f.chat.add(message),false);assert.equal(f.list.children.length,1);assert.equal(f.floatLayer.children.length,1);
 assert.equal(f.notifications.length,1);f.chat.add({id:'history',at:5,seat:3,text:'History',live:false});assert.equal(f.list.children.length,2);assert.equal(f.floatLayer.children.length,1);assert.equal(f.notifications.length,1);
});

test('floating layer cannot block board or card interaction',()=>{
 const css=fs.readFileSync('game.css','utf8');
 assert.match(css,/#chatFloatLayer\{[^}]*pointer-events:none/);
 assert.match(css,/#chatBody\[hidden\]\{display:none/);
});
