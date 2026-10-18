/* Pure movement planning and queueing. Game rules remain authoritative in game.js. */
(function(root){
  'use strict';
  const TRACK=76,YARD=-100,HOME=1000,ENTRY=[0,19,38,57];

  function cellPath(move){
    if(!move||move.k==='skip'||move.k==='swap')return[];
    if(move.k==='out')return[0];
    const count=Number.isInteger(move.n)?move.n:move.k==='back'?4:0;
    if(count<1||!Number.isInteger(move.from)||!Number.isInteger(move.to))return[];
    const path=[];
    if(move.k==='back'){
      for(let step=1;step<=count;step++)path.push(((move.from-step)%TRACK+TRACK)%TRACK);
    }else if(move.from>=HOME){
      for(let step=1;step<=count;step++)path.push(move.from+step);
    }else{
      const threshold=move.from>=75?151:75;
      for(let step=1;step<=count;step++){
        const raw=move.from+step;
        if(move.to>=HOME&&raw>=threshold)path.push(HOME+raw-threshold);
        else if(move.to<move.from&&raw>=151)path.push(raw-TRACK);
        else path.push(raw);
      }
    }
    if(path.length)path[path.length-1]=move.to;
    return path;
  }

  function describe(move,id,at,team,board){
    const motion={id:String(id),at:Number(at),k:move.k,c:move.c,i:move.i,from:move.from,to:move.to,path:cellPath(move),team:Number(team),captures:[]};
    motion.captures=(move.caps||[]).map(([c,i])=>({c,i,from:board?.[c]?.[i]??YARD}));
    if(move.k==='swap'){
      motion.tp=move.tp;motion.tj=move.tj;
      motion.from=board?.[move.c]?.[move.i]??move.from;
      motion.targetFrom=board?.[move.tp]?.[move.tj]??null;
      const firstAbsolute=(ENTRY[move.c]+motion.from)%TRACK,targetAbsolute=(ENTRY[move.tp]+motion.targetFrom)%TRACK;
      motion.to=(targetAbsolute-ENTRY[move.c]+TRACK)%TRACK;
      motion.targetTo=(firstAbsolute-ENTRY[move.tp]+TRACK)%TRACK;
    }
    return motion;
  }

  function runCellSequence(motion,animateCell,onLanding,onComplete){
    const path=Array.isArray(motion?.path)?motion.path:[];
    let index=0,cancelled=false;
    const next=()=>{
      if(cancelled)return;
      if(index>=path.length){onComplete?.();return;}
      const cell=path[index],landing=index;
      animateCell(cell,landing,()=>{
        if(cancelled)return;
        onLanding?.(cell,landing);
        index++;
        next();
      });
    };
    next();
    return{cancel(){cancelled=true},get cancelled(){return cancelled}};
  }

  function shouldAnimate(motion,{now=Date.now(),initial=false,reduced=false,hidden=false,maxAge=3500}={}){
    return !!(motion&&typeof motion.id==='string'&&motion.id&&Number.isFinite(motion.at)&&!initial&&!reduced&&!hidden&&now-motion.at<=maxAge&&motion.at-now<10000);
  }

  function createQueue(run,onCancel){
    const pending=[],seen=new Set();let active=null,generation=0;
    const pump=()=>{
      if(active||!pending.length)return;
      const motion=pending.shift(),token=generation;
      active={motion,handle:null};
      const done=()=>{
        if(token!==generation||!active||active.motion!==motion)return;
        active=null;pump();
      };
      active.handle=run(motion,done)||null;
    };
    return{
      enqueue(motion){
        if(!motion||typeof motion.id!=='string'||!motion.id||seen.has(motion.id))return false;
        seen.add(motion.id);if(seen.size>64)seen.delete(seen.values().next().value);
        pending.push(motion);pump();return true;
      },
      cancel(){generation++;pending.length=0;active?.handle?.cancel?.();active=null;onCancel?.();},
      get busy(){return !!active||pending.length>0},
      get size(){return pending.length+(active?1:0)}
    };
  }

  const api={cellPath,describe,runCellSequence,shouldAnimate,createQueue};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JackarooMotion=api;
})(typeof window!=='undefined'?window:globalThis);
