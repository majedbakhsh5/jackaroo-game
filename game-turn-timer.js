/* Host-authoritative turn and one-time card-selection grace timing. */
(function(root){
  'use strict';
  const TURN_MS=10000,GRACE_MS=5000;
  const key=state=>`${Number(state?.turnAt)||0}:${Number(state?.turn)||0}:${state?.phase||''}`;
  function begin(state){return{key:key(state),seat:Number(state.turn),selected:null,graceUsed:false,graceUntil:0,resolved:false,auto:false}}
  function ensure(timer,state){return timer&&timer.key===key(state)&&timer.seat===Number(state.turn)?timer:begin(state)}
  const sameCard=(a,b)=>!!a&&!!b&&a.r===b.r&&a.s===b.s;
  function sameSelection(timer,selection){return !!timer?.selected&&timer.selected.index===selection?.index&&sameCard(timer.selected.card,selection?.card)}
  function select(timer,state,selection,at){
    const current=ensure(timer,state),deadline=Number(state.turnAt)+TURN_MS;
    const card=selection?.card;
    if(current.resolved||!selection?.legal||!Number.isInteger(selection.index)||!card||typeof card.r!=='string'||typeof card.s!=='string'||Number(at)>deadline)return current;
    if(current.graceUntil&&current.selected&&!sameSelection(current,selection))return current;
    return{...current,selected:{index:selection.index,card:{r:selection.card.r,s:selection.card.s}}};
  }
  function clear(timer,state,selection,at){
    const current=ensure(timer,state),deadline=Number(state.turnAt)+TURN_MS;
    if(current.resolved||current.graceUntil||Number(at)>deadline||!sameSelection(current,selection))return current;
    return{...current,selected:null};
  }
  function remaining(timer,state,now){
    const current=ensure(timer,state),mode=current.graceUntil?'grace':'turn',deadline=current.graceUntil||Number(state.turnAt)+TURN_MS;
    return{mode,seconds:Math.max(0,Math.ceil((deadline-Number(now))/1000)),deadline};
  }
  function presentation(timer,state,now,options={}){
    const current=ensure(timer,state),time=remaining(current,state,now),active=Number(options.viewerSeat)===Number(state.turn)&&options.connected!==false&&!options.busy&&!options.over&&!current.resolved&&state.phase==='play';
    return{...time,visible:active&&time.seconds>0&&time.seconds<=5,label:time.mode==='grace'?'مهلة اختيار الحجر':'أسرع'};
  }
  function resolve(timer,state){const current=ensure(timer,state);return{...current,resolved:true}}
  function expire(timer,state,now,selectedHasLegal){
    const current=ensure(timer,state),originalDeadline=Number(state.turnAt)+TURN_MS,at=Number(now);
    if(current.resolved)return{kind:'none',timer:current};
    if(current.graceUntil){
      if(at<current.graceUntil)return{kind:'waiting',timer:current};
      return{kind:'selected-timeout',timer:{...current,resolved:true,auto:true}};
    }
    if(at<originalDeadline)return{kind:'waiting',timer:current};
    if(state.phase==='play'&&current.selected&&selectedHasLegal){
      const granted={...current,graceUsed:true,graceUntil:originalDeadline+GRACE_MS};
      if(at>=granted.graceUntil)return{kind:'selected-timeout',timer:{...granted,resolved:true,auto:true}};
      return{kind:'grant-grace',timer:granted};
    }
    return{kind:'normal-timeout',timer:{...current,resolved:true}};
  }
  function bestAction(moves,score){let best=null,bestScore=-Infinity;for(const move of moves||[]){const value=Number(score(move));if(best===null||value>bestScore){best=move;bestScore=value}}return best}
  const api={TURN_MS,GRACE_MS,key,begin,ensure,select,clear,sameSelection,remaining,presentation,resolve,expire,bestAction};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JackarooTurnTimer=api;
})(typeof window!=='undefined'?window:globalThis);
