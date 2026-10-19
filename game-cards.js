/* Pure card presentation helpers. Game rules and private hands stay in game.js/room-client.js. */
(function(root){
  const ranks=new Set(['A','2','3','4','5','6','7','8','9','10','J','Q','K']);
  const suits=new Set(['♠','♥','♦','♣']);
  function identity(card){
    if(!card||!ranks.has(card.r)||!suits.has(card.s))return null;
    return{rank:card.r,suit:card.s,key:card.r+card.s,red:card.s==='♥'||card.s==='♦'};
  }
  function position(index,total){
    const count=Math.max(1,Number(total)||1),distance=index-(count-1)/2;
    return{angle:Math.max(-12,Math.min(12,distance*5)),lift:Math.min(8,Math.abs(distance)*3),side:Math.min(5,Math.abs(distance)*2),z:index+1};
  }
  function hand(cards,{visible=true,selected=null}={}){
    if(!visible||!Array.isArray(cards))return[];
    return cards.map((card,index)=>{
      const value=identity(card);if(!value)return null;
      return{...value,index,selected:index===selected,ariaLabel:`${value.rank} ${value.suit}`,position:position(index,cards.length)};
    }).filter(Boolean);
  }
  function createAnimationState(){
    let generation=0,active=null;
    return{
      begin(kind){active={kind,generation:++generation};return active},
      cancel(){generation++;active=null},
      isCurrent(token){return !!token&&token===active&&token.generation===generation},
      finish(token){if(!this.isCurrent(token))return false;active=null;return true},
      get active(){return active}
    };
  }
  const api={identity,position,hand,createAnimationState};
  root.JackarooCards=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
