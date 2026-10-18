const {test}=require('node:test');
const assert=require('node:assert/strict');
const Motion=require('../game-motion.js');

test('normal and backward moves expose every legal cell in order',()=>{
 assert.deepEqual(Motion.cellPath({k:'fwd',from:8,to:13,n:5}),[9,10,11,12,13]);
 assert.deepEqual(Motion.cellPath({k:'back',from:2,to:74,n:4}),[1,0,75,74]);
});

test('base exits, safety entry and home movement end at the authoritative position',()=>{
 assert.deepEqual(Motion.cellPath({k:'out',from:-100,to:0}),[0]);
 assert.deepEqual(Motion.cellPath({k:'fwd',from:73,to:1002,n:4}),[74,1000,1001,1002]);
 assert.deepEqual(Motion.cellPath({k:'fwd',from:1000,to:1003,n:3}),[1001,1002,1003]);
 assert.deepEqual(Motion.cellPath({k:'fwd',from:150,to:79,n:5}),[75,76,77,78,79]);
});

test('seven-card split paths retain seven visible steps across two pieces',()=>{
 const first=Motion.describe({k:'fwd',c:0,i:0,from:10,to:13,n:3,caps:[]},'7-a',100,0,[[-100,-100,-100,-100],[-100,-100,-100,-100],[-100,-100,-100,-100],[-100,-100,-100,-100]]);
 const second=Motion.describe({k:'fwd',c:0,i:1,from:20,to:24,n:4,caps:[]},'7-b',101,0,[[-100,-100,-100,-100],[-100,-100,-100,-100],[-100,-100,-100,-100],[-100,-100,-100,-100]]);
 assert.equal(first.path.length+second.path.length,7);
 assert.equal(first.path.at(-1),13);
 assert.equal(second.path.at(-1),24);
});

test('capture metadata preserves the captured origin and does not alter mover steps',()=>{
 const board=[[10,-100,-100,-100],[13,-100,-100,-100],[-100,-100,-100,-100],[-100,-100,-100,-100]];
 const motion=Motion.describe({k:'fwd',c:0,i:0,from:10,to:13,n:3,caps:[[1,0]]},'cap',100,0,board);
 assert.deepEqual(motion.path,[11,12,13]);
 assert.deepEqual(motion.captures,[{c:1,i:0,from:13}]);
 assert.equal(motion.to,13);
});

test('a Jack swap has no fabricated path and preserves both authoritative endpoints',()=>{
 const board=[[5,-100,-100,-100],[12,-100,-100,-100],[-100,-100,-100,-100],[-100,-100,-100,-100]];
 const motion=Motion.describe({k:'swap',c:0,i:0,tp:1,tj:0,caps:[]},'swap',100,0,board);
 assert.deepEqual(motion.path,[]);
 assert.deepEqual({from:motion.from,to:motion.to,targetFrom:motion.targetFrom,targetTo:motion.targetTo},{from:5,to:31,targetFrom:12,targetTo:62});
});

test('one marble contact is emitted for each completed visible landing',()=>{
 const motion={path:[11,12,13,14]};
 const completions=[];let sounds=0,finished=0;
 Motion.runCellSequence(motion,(cell,index,complete)=>completions.push(complete),()=>sounds++,()=>finished++);
 while(completions.length)completions.shift()();
 assert.equal(sounds,4);
 assert.equal(finished,1);
});

test('motion queue deduplicates repeated snapshots and preserves action order',()=>{
 const started=[],finishes=[];
 const queue=Motion.createQueue((motion,done)=>{started.push(motion.id);finishes.push(done);return{cancel(){}}});
 assert.equal(queue.enqueue({id:'one'}),true);
 assert.equal(queue.enqueue({id:'one'}),false);
 assert.equal(queue.enqueue({id:'two'}),true);
 assert.deepEqual(started,['one']);
 finishes.shift()();
 assert.deepEqual(started,['one','two']);
});

test('initial, stale, reduced-motion and background snapshots reconcile immediately',()=>{
 const motion={id:'m',at:1000};
 assert.equal(Motion.shouldAnimate(motion,{now:1200}),true);
 assert.equal(Motion.shouldAnimate(motion,{now:1200,initial:true}),false);
 assert.equal(Motion.shouldAnimate(motion,{now:6000}),false);
 assert.equal(Motion.shouldAnimate(motion,{now:1200,reduced:true}),false);
 assert.equal(Motion.shouldAnimate(motion,{now:1200,hidden:true}),false);
});

test('cancelling an animation suppresses pending landings and queued work',()=>{
 const completions=[];let sounds=0,reconciled=0;
 const queue=Motion.createQueue((motion,done)=>Motion.runCellSequence(motion,(cell,index,complete)=>completions.push(complete),()=>sounds++,done),()=>reconciled++);
 queue.enqueue({id:'one',path:[1,2,3]});
 queue.enqueue({id:'two',path:[4]});
 queue.cancel();
 completions.shift()();
 assert.equal(sounds,0);
 assert.equal(queue.size,0);
 assert.equal(reconciled,1);
});
