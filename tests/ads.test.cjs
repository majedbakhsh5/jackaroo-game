const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../ads.js'),'utf8');
function run(config,width=1366,height=768){
 const boxes={rail:box(),bn:box()},classes=new Set(),events={},scripts=[];
 function box(){return {dataset:{},children:[],setAttribute(){},append(...items){this.children.push(...items)}}}
 const context={window:{ADS_CONFIG:config,addEventListener:(name,fn)=>events[name]=fn},document:{readyState:'complete',body:{classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name),remove:(...names)=>names.forEach(n=>classes.delete(n))}},head:{appendChild:s=>scripts.push(s)},getElementById:id=>boxes[id],querySelectorAll:()=>[],createElement:()=>({...box(),style:{}})},MutationObserver:class{observe(){}disconnect(){}},matchMedia:query=>({matches:query.includes('1200')?width>=1200&&height>=700:width>=360&&width<=767&&height>=1050})};
 vm.runInNewContext(source,context);return {boxes,classes,events,scripts,window:context.window};
}
const config={client:'ca-pub-1170827657733432',privacyReady:true,slotRail:'1234567890',slotBanner:'1234567891',mobileBanner:true};
test('ad setup remains inactive until consent messaging is configured',()=>{const r=run({...config,privacyReady:false});assert.equal(r.scripts.length,0);assert.equal(r.classes.size,0)});
test('the consent tag loads even when no ad slot fits; no ad request or game gutter is created',()=>{const r=run({...config,slotRail:'',slotBanner:''});assert.equal(r.scripts.length,1);assert.equal(r.window.adsbygoogle,undefined);assert.equal(r.classes.size,0);assert.equal(r.window.googlefc.callbackQueue.length,1)});
test('desktop unit loads once and does not refresh on resize',()=>{
 const r=run(config);assert(r.classes.has('wide'));assert.equal(r.scripts.length,1);assert.equal(r.window.adsbygoogle.length,1);r.events.resize();r.events.resize();assert.equal(r.scripts.length,1);assert.equal(r.window.adsbygoogle.length,1);
});
test('small mobile screens retain their full game area',()=>{const r=run(config,390,844);assert.equal(r.classes.size,0);assert.equal(r.window.adsbygoogle,undefined);assert.equal(r.scripts.length,1)});
test('network failure releases reserved ad space and does not retry on resize',()=>{const r=run(config);r.scripts[0].onerror();assert.equal(r.classes.size,0);r.events.resize();assert.equal(r.classes.size,0);assert.equal(r.scripts.length,1)});
